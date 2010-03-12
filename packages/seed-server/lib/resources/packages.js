// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:private/co'),
    server = require('server'),
    Token  = require('models/token'),
    url    = require('url'),
    semver = require('seed:semver'),
    PackageInfo = require('models/package_info');

// ..........................................................
// RESOURCE API
// 

// retrieves a list of all installed packages matching a given filter
exports.index = function(req, res) {
  var query = url.parse(req.url, true).query;
  var offset, limit, name, version, deps;
  
  if (query) {
    offset = Number(query.offset);
    limit  = Number(query.limit);
    name   = query.name;
    version = query.version;
    deps    = query.dependencies;
  } else {
    offset = 0;
    limit = 1000000;
    name = version = deps = null;
  }
      
  if (isNaN(offset)) offset = 0;
  if (isNaN(limit)) limit = 10000000; // effectively no limit 
  if (name) name = name.toLowerCase();
  if (version) version = semver.normalize(version.toString());
  
  if (version && !name) {
    return server.error(res, 400, 'version param requires name param');
  }
  
  // search for dependencies if requested AND filtering by name
  if (deps) deps = deps.toLowerCase();
  deps = (!!name && ((deps==='true') || (deps==='yes') || (deps==='1')));
    
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403, 'No valid user');

    // find all packages
    Co.chain(function(done){
      PackageInfo.findAll(done);

    // then filter by name or version if needed
    }, function(packages, done) {
      Co.sys.debug('1: found: ' + packages.map(function(p) { return p.id; }).join(',') + ' name = ' + name);
      
      if (!name) return done(null, packages);  // skip this filter
      Co.reduce(packages, [], function(ret, packageInfo, done) {
        if (packageInfo.name().toLowerCase() === name) {
          if (!version || (packageInfo.version() === version)) {
            ret.push(packageInfo);
          }
        }
        done(null, ret);
      })(done);

    // if we require dependencies, then find all dependencies
    // note that at top we make sure dep is always false if not filtering 
    // by name
    }, function(packages, done) {
      Co.sys.debug('2: found: ' + packages.map(function(p) { return p.id; }).join(',') + ' deps = ' + deps);

      if (!deps) return done(null, packages); // nothing to do
      
      var ret = [], seen = {};
      
      function addPackage(packageInfo, done) {
        if (seen[packageInfo.id]) return done();

        ret.push(packageInfo);
        seen[packageInfo.id] = true;
        
        Co.each(packageInfo.dependencies(), function(packageId, done) {
          PackageInfo.findCompatible(packageId, function(err, curInfo) {
            if (err) return done(err);
            if (!curInfo) done(); // nothing to do if dependency not found
            else addPackage(curInfo, done);
          });
        })(done);
      }
      
      Co.each(packages, function(curInfo, done) {
        addPackage(curInfo, done);
      })(function(err) {
        if (err) return done(err);
        else return done(null, ret);
      });
      
    // finally filter based on if you have access to see a given package
    }, function(packages, done) {
      Co.sys.debug('3: found: ' + packages.map(function(p) { return p.id; }).join(','));

      Co.filter(packages, function(packageInfo, done) {
        // first, only return packages you can show for this user
        packageInfo.acl(function(err, acl) {
          if (err) return done(err);
          var ret = acl && currentUser.canShowPackageInfo(packageInfo, acl);
          return done(null, ret);
        });
      })(done);

    // encode and return
    })(function(err, packages) {
      Co.sys.debug('4: found: ' + packages.map(function(p) { return p.id; }).join(','));

      if (err) return done(err);
      packages = packages.map(function(packageInfo) {
        return packageInfo.indexJson(currentUser);
      });
      var count = packages.length;
      if ((offset>0) || (limit<count)) {
        packages = packages.slice(offset, offset+limit);
      }
      
      return res.simpleJson(200, { 
        "offset": offset,
        "count": count,
        "records": packages
      });
    });
    
  });
};


// you can only retrieve package info if you or your group are readers or you
// are admin
exports.show = function(req, res, id) {
  var idx = id.indexOf('/'), version = null;
  if (idx>=0) {
    version = id.slice(idx+1);
    id = id.slice(0,idx);
  }

  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
    
    // if no version was specified then discover the latest version installed
    // and use that instead
    (function(done) {
      if (version) return done(null, version);
      PackageInfo.latestVersionFor(id, done);
      
    })(function(err, version) {
      if (err|| !version) return server.error(res, err || 404, 'No matching version');
      
      id = Co.path.join(id, version);
      Co.sys.debug('finding packageId='+id);
      PackageInfo.find(id, function(err, packageInfo) {
        if (err || !packageInfo) return server.error(res, err || 404, 'No matching package');
        packageInfo.acl(function(err, acl) {
          if (err || !acl) return server.error(res, err || 'missing acl');
          if (!currentUser.canShowPackageInfo(packageInfo, acl)) {
            return server.forbidden(res);
          }

          return res.simpleJson(200, packageInfo.showJson(currentUser));
        });
      });
    });
  });
};

// you can't modify package info once it is deployed
exports.update = function(req, res, id) {
  return server.error(res, 403, 'Package info is updated automatically when you publish new assets');
};

// you can't create new packages.  Just publish new package assets to make 
// the info available.
exports.create = function(req, res, id) {
  return server.error(res, 403, "To create a new package, just upload a new package asset");
};

// you can destroy a single package version or all versions of a package.  
// This will delete any associated Acls and assets.  You must be an owner or
// writer of the package to destroy it or admin
exports.destroy = function(req, res, id) {
  var idx = id.indexOf('/'), version = null;
  if (idx>=0) {
    version = id.slice(idx+1);
    id = id.slice(0,idx);
  }
  
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
  });
};

// ..........................................................
// HELPERS
// 

exports.install = function(pkg, assetFilename, done) {
  // var info = Co.mixin({}, pkg.info()); // copy and fixup
  // info['link-asset'] = '/seed/assets/'+assetFilename;
  // info['link-self'] = '/seed/packages/'+pkg.name()+'?version='+pkg.version();
  // 
  // var infoPath = Co.path.join(server.root, 'packages', pkg.name(), pkg.version() + '.json');
  // server.writeJson(infoPath, info, done);
};