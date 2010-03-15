// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:private/co'),
    server = require('server'),
    Record = require('models/record'),
    Acl    = require('models/acl'),
    semver = require('seed:semver');


var PackageInfo = Record.extend({
  kind: 'packages',
  
  assetId: function() {
    return this.data['.seed-asset'];
  },
  
  aclId: function() {
    var aclId = this.id, idx = aclId.lastIndexOf('/');
    if (idx>=0) aclId = aclId.slice(0,idx);
    aclId = 'packages/'+aclId;
    return aclId;
  },
  
  // find the acl for this package info...
  acl: function(done) {
    return Acl.find(this.aclId(), done);
  },
  
  name: function() {
    if (!this.isOpen) throw "package " + this.id + " must be open";
    return this.data.name;
  },
  
  version: function() {
    if (!this.isOpen) throw "package " + this.id + " must be open";
    return semver.normalize(this.data.version);
  },
  
  // returns ids for dependent packages - if any
  dependencies: function() {
    if (!this.isOpen) throw "package " + this.id + " must be open";
    var deps = this.data.dependencies;
    if (!deps) return []; // none
    
    var ret = [];
    for(var key in deps) {
      if (!deps.hasOwnProperty(key)) continue; 
      ret.push(key + '/' + semver.normalize(deps[key]));
    }  
    return ret ;
  },
  
  assetPath: function() {
    return Co.path.join(server.root, 'assets', this.assetId());    
  },
  
  indexJson: function() {
    var ret = Record.prototype.indexJson.apply(this, arguments);
    ret['link-asset'] = '/seed/assets/' + this.id + '.zip';
    delete ret['.seed-asset'];
    return ret ;
  }
    
});

// discovers all packages in the repository.  needs some special code because
// of storing in multiple directories
PackageInfo.findAll = function(done) {
  var path = Co.path.join(server.root, 'packages');
  Co.fs.glob(path, function(err, filenames) {
    if (err) return done(err);
    if (!filenames) filenames = [];
    Co.reduce(filenames, [], function(ret, filename, done) {
      if (!filename.match(/\.json$/)) return done(null, ret); //nothing to do
      filename = filename.slice(0, -5); // cut .json
      PackageInfo.find(filename, function(err, packageInfo) {
        if (err) return done(err);
        if (packageInfo) ret.push(packageInfo);
        return done(null, ret);
      });
    })(done);
  });
};

/**
  Get the latest package compatible with the named package.  This is the 
  package that should be installed
*/
PackageInfo.findCompatible = function(id, done) {
  var idx = id.lastIndexOf('/'),  
      vers = idx>=0 ? id.slice(idx+1) : null;
  if (idx>=0) id = id.slice(0,idx);
  
  var path = Co.path.join(server.root, 'packages', id);
  
  Co.fs.glob(path, function(err, versions) {
    if (err) return done(err);
    if (!versions) return done(); // nothing found

    var max = null;
    versions.forEach(function(cur) {
      if (!cur.match(/\.json$/)) return; // nothing to do
      cur = cur.slice(0,-5);
      if (semver.compatible(vers, cur)) {
        if (!max || (semver.compare(cur, max)>0)) max = cur;
      }
    });
    
    if (!max) return done();
    else PackageInfo.find(id+'/'+max, done);
  });
};


// takes an existing Package in memory and installs the package info into 
// the database.
PackageInfo.install = function(pkg, srcPath, currentUser, done) {
  
  // first make sure that the package does not already exists
  var packageId = Co.path.join(pkg.name(), pkg.version());
  var assetFilename = pkg.name() + '-' + pkg.version() + '.zip';
  
  Co.chain(function(done) {
    PackageInfo.find(packageId, function(err, packageInfo) {
      if (!err && packageInfo) {
        err = {
          status: 400,
          message: 'Package version already exists.  Change version to resubmit'
        };
      }
      
      return done(err);
    });
  },

  // does not exist.  Try to find a matching acl and make sure user has perm
  function(done) {
    var aclId = packageId, idx = aclId.lastIndexOf('/');
    if (idx>=0) aclId = aclId.slice(0,idx);
    aclId = 'packages/'+aclId;
    
    Acl.find(aclId, function(err, acl) {
      if (err) return done(err);
      if (!currentUser.canUploadPackage(acl)) {
        return done({ status: 403, message: 'Not package owner or writer' });
      } else return done(); 
    });
  },
  
  // does not exist, copy over the asset then create the package...
  function(done) {
    var dstPath = Co.path.join(server.root, 'assets', assetFilename);

    // remove any existing asset by that name
    Co.chain(function(done) {
      Co.path.exists(dstPath, function(err, exists) {
        if (err || !exists) return done(err);
        Co.fs.rm_r(dstPath, function(err) { done(err); });
      });
    },
    
    // copy over new asset
    function(done) {
      Co.fs.mkdir_p(Co.path.dirname(dstPath), 511, function(err) {
        if (err) return done(err);
        Co.fs.cp_r(srcPath, dstPath, function(err) { done(err); });
      });
      
    })(done);
  },
  
  // asset copied, create the package info
  function(done) {
    var info = Co.mixin({}, pkg.info());
    info['.seed-asset'] = assetFilename;
    PackageInfo.create(packageId, info, function(err, packageInfo) {
      if (err) return done(err);
      packageInfo.write(function(err) { 
        done(err, err ? null : packageInfo);
      });
    });
  },
  
  // and then create an acl if needed
  function(packageInfo, done) {
    packageInfo.acl(function(err, acl) {
      if (err || acl) return done(err);
      
      // default acl
      var aclId = packageInfo.aclId();
      var info = { 
        owners: ['users/'+currentUser.id], 
        readers: ['users/anonymous'],
        writers: []
      };

      Acl.create(aclId, info, function(err, acl) { 
        if (err) return done(err);
        acl.write(function(err) { done(err, err ? null : acl); });
      });
    });
  })(done);
};

PackageInfo.latestVersionFor = function(packageId, done) {
  var path = this.prototype.pathForId(packageId).slice(0,-5); // no .json
  Co.fs.readdir_p(path, function(err, dirs) {

    if (err) return done(err);
    if (!dirs) return done(); // not found

    // find latest version
    var vers = null;
    dirs.forEach(function(dirname) {
      dirname = dirname.slice(0, -5);
      if (!vers || (semver.compare(vers, dirname)<0)) vers = dirname;
    });
    return done(null, vers); 
  });
};

exports = module.exports = PackageInfo;
