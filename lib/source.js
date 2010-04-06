// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var CORE    = require('./private/core'),
    Package = require('./package').Package,
    Source;
    
/**
  A Source describes a single location
*/
Source = CORE.extend(Object);
exports.Source = Source;

Source.CLOSED  = 'closed';
Source.OPENING = 'opening';
Source.ERROR   = 'error';
Source.OPEN    = 'open';

Source.prototype.init = function(path) {
  this.path = path;
  this.config = {};
  this.packagesByPath = {};
  this.packagesById   = {};
  this.normalized     = {};
};

// ..........................................................
// REPOSITORY CONFIG
// 

// for now - nothing to normalize...
Source.prototype.normalize = function(key, value, writing) {
  return value;
};


Source.prototype.get = function(key) {
  this.open();
  var ret = this.normalized[key];
  if (ret === undefined) {
    ret = this.normalized[key] = this.normalize(key, this.config[key], false);
  }
  return ret ;
};

Source.prototype.set = function(key, value) {
  this.open();
  value = this.normalize(key, value, true);
  this.normalized[key] = this.config[key] = value;
  return this;
};

/**
  Write the config file back to disk.
*/
Source.prototype.writeConfig = function() {
  var path = CORE.path.join(this.path, 'config.json');
  CORE.fs.mkdir_p(CORE.path.dirname(path));
  CORE.fs.writeJSON(path, this.config);
};

// ..........................................................
// OPEN/CLOSE
// 

Source.prototype.state = Source.CLOSED;

/**
  Opens the package, if it is not already open.  This will read in the 
  package.json as well as a local.json - if it exists - and merge it in.

  @returns {Package} receiver
*/
Source.prototype.open = function() {
  var path;
  
  if (this.state === Source.OPENING) {
    throw new Error("Cannot call Source.open() while opening async");
  }
  
  if (this.state === Source.OPEN) return this;
  this.state = Source.OPENING;
  
  path = CORE.path.join(this.path, 'config.json');
  if (CORE.fs.exists(path)) this.config = CORE.fs.readJSON(path);
  
  this.state = Source.OPEN;
  return this;
};

Source.prototype.close = function() {
  if (this.state !== Source.CLOSED) return this;
  this.config = {};
  this.normalized = {};
  this.state = Source.CLOSED;
  return this ;
};

// ..........................................................
// SOURCE SUPPORT
// 

Source.prototype._packageForPath = function(path) {
  var ret = this.packagesByPath[path];
  if (!ret) {
    ret = new Package('::'+path, path, this);
    this.packagesByPath[path] = ret;
    this.packagesById[ret.id] = ret;
  }
  return ret ;
};

Source.prototype.catalogPackages = function() {
  var path, pkgnames, versions, len, idx, 
      vlen, vidx, pkgpath, searchPath, ret;
  
  path = CORE.path.join(this.path, 'packages');
  pkgnames = CORE.fs.readdir_p(path);

  ret = [];
  len = pkgnames ? pkgnames.length : 0;
  for(idx=0;idx<len;idx++) {
    pkgpath = CORE.path.join(path, pkgnames[idx]);
    versions = CORE.fs.readdir_p(pkgpath);
    vlen = versions ? versions.length : 0;
    for(vidx=0;vidx<vlen;vidx++) {
      searchPath = CORE.path.join(pkgpath, versions[vidx]);
      ret.push(this._packageForPath(searchPath));
    }
  }

  return ret ;
};

Source.prototype.canonicalPackageId = function(packageName, vers) {
  var path, dirnames, idx, len, pkg, cvers, rvers, ret;
  
  path = CORE.path.join(this.path, 'packages', packageName);
  dirnames = CORE.fs.readdir_p(path);
  if (!dirnames) return null;
  
  len = dirnames.length;
  for(idx=0;idx<len;idx++) {
    pkg = this._packageForPath(CORE.path.join(path,dirnames[idx]));
    cvers = pkg.get('version');
    if (!CORE.semver.compatible(vers, cvers)) continue;
    if (!ret || (CORE.semver.compare(rvers, cvers)<0)) {
      ret = pkg;
      rvers = cvers;
    }
  }

  return ret ? ret.id : null;
};

Source.prototype.packageFor = function(canonicalId) {
  return this.packagesById[canonicalId];
};

Source.prototype.ensurePackage = function(canonicalId, done) {
  var idx, len, packageName, path, dirnames, next, repo;
  
  idx = canonicalId.lastIndexOf('/');
  packageName = canonicalId.slice(2, idx);
  path = CORE.path.join(this.path, 'packages', packageName);
  
  dirnames = CORE.fs.readdir_p(path);
  if (!dirnames || dirnames.length===0) return done(); // nothing to do
  
  idx  = 0;
  len  = dirnames.length;
  repo = this;  
  next = function() {
    var packagePath, pkg;
    
    if (idx>=len) return done(); // finished
    packagePath = CORE.path.join(path, dirnames[idx]);
    idx++;
    
    pkg = repo._packageForPath(packagePath);
    if (!pkg) next();
    
    pkg.ensureOpen(function(err) {
      if (err) return done(err);
      if (pkg.id === canonicalId) return done(); // found it
      next(); // otherwise next...
    });
  };
  
  next();
};

// ..........................................................
// PACKAGE MANAGEMENT
// 

Source.prototype.acceptsInstalls = true;

/**
  Installs executables for the named package.  Invoked automatically for
  install/remove
*/
Source.prototype.installExecutables = function(latestPackage, done) {
  var repo = this;
  
  CORE.iter.chain(function(done) {
    latestPackage.findExecutables(done);
  },

  // if any execs are passed in, install them into the bin dir from 
  // the repository config
  function(execs, done) {
    if (!execs) return done(); // skip
    
    var bindir = repo.get('bin') || CORE.path.join(repo.path, 'bin');
    CORE.fs.mkdir_p(bindir, CORE.fs.A_RWX, function(err) {
      if (err) return done(err);
      
      // convert hash into an array of src/dst paths so we can run them in
      // parallel
      var links = [];
      for(var binname in execs) {
        if (!execs.hasOwnProperty(binname)) continue;
        var src = execs[binname];
        var dst = CORE.path.join(bindir, binname);
        links.push({ src: src, dst: dst });
      }
      
      return done(null, links);
    });
  },
  
  function(links, done) {
      
    // create each symlink
    CORE.iter.parallel(links, function(link, done) {

      // delete existing bin if it exists
      CORE.iter.chain(function(done) {
        CORE.fs.exists(link.dst, function(err, exists) {
          if (err) return done(err);
          if (!exists) return done();
          else CORE.fs.rm_r(link.dst, CORE.err(done));
        });
      },

      // generate new bin
      function(done) {
        var script = '#!/usr/bin/env sh\nexec '+link.src + ' $@\n';
        CORE.verbose('installing executable at ' + link.dst);
        CORE.fs.writeFile(link.dst,script, function(err) {
          if (err) return done(err);
          CORE.fs.chmod(link.dst, CORE.fs.A_RWX, done);
        });
      })(done);
      
    })(done);
  })(done);
};

/**
  Remove any executables for the named package
*/
Source.prototype.removeExecutables = function(latestPackage, done) {
  var repo = this;
  
  CORE.iter.chain(function(done) {
    latestPackage.findExecutables(done);
  },

  // if any execs are passed in, install them into the bin dir from 
  // the repository config
  function(execs, done) {    
    if (!execs) return done(); // skip
    
    var bindir = repo.get('bin') || CORE.path.join(repo.path, 'bin');
      
    // convert hash into an array of dst paths so we can run them in
    // parallel
    var links = [];
    for(var binname in execs) {
      if (!execs.hasOwnProperty(binname)) continue;
      var src = execs[binname];
      var dst = CORE.path.join(bindir, binname);
      links.push(dst);
    }
      
    return done(null, links);
  },
  
  function(links) {
      
    // create each symlink
    CORE.iter.parallel(links, function(path, done) {
      CORE.fs.exists(path, function(err, exists) {
        if (err) return done(err);
        if (exists) {
          CORE.verbose('removing executable at ' + path);
          CORE.fs.rm_r(path, done);
        } else return done(); 
      });
    })(done);

  })(done);
};

/**
  Installs a Package into the current repository.
*/
Source.prototype.install = function(pkg, done) {
  var installName = CORE.path.join(pkg.get('name'), pkg.get('version')),
      srcPath = pkg.path,
      dstPath = CORE.path.join(this.path, 'packages', installName),
      repo = this;
      
  CORE.println("Installing " + installName + "...");
  CORE.verbose("  from:" + srcPath + " to:" +dstPath);
  
  // if path already exists, remove it - we are overwriting it
  CORE.iter.chain(function(done) {
    if (CORE.fs.exists(dstPath)) {
      CORE.verbose('Replacing installed package ' + installName);
      CORE.fs.rm_r(dstPath, function(err) { return done(err); });
    } else done();
  },

  // copy those mothers...
  function(done) {
    CORE.verbose('collecing paths from '+srcPath);
    pkg.copy(dstPath, done);
  },
  
  // find the newest package installed in the repository to see if it is 
  // this one
  function(done) {
    var canonicalId = repo.canonicalPackageId(pkg.get('name'), null);
    if (!canonicalId) return done(null, null);
    
    return done(null, repo.packageFor(canonicalId));
  },
  
  // find executables to install if this is the latest version
  function(latestPackage, done) {
    if (latestPackage.get('version') !== pkg.get('version')) return done(); 
    repo.installExecutables(latestPackage, done);
    
  // success!
  })(done);
};

/**
  Removes a package instance from the repository
*/
Source.prototype.remove = function(pkg, done) {
  var installName = CORE.path.join(pkg.get('name'),pkg.get('version')),
      dstPath = CORE.path.join(this.path, 'packages', installName),
      repo = this;

  CORE.println("Removing " + installName+"...");
  
  // first, before removing this package, find the latest package
  CORE.iter.chain(function(done) {
    // always remove executables first - we may reinstall later
    repo.removeExecutables(pkg, done);
  },
  
  function() {
    var done = arguments[arguments.length-1];
    CORE.fs.exists(dstPath, function(err, exists) {
      if (!err && !exists) err = new Error(installName + ' not found');
      if (err) return done(err);
      CORE.fs.rm_r(dstPath, done);
    });
  },

  // install executables for new latest version if installed
  function() {
    var done = arguments[arguments.length-1]; 
    var canonicalId = repo.canonicalPackageId(pkg.get('name'), null);
    var latest = canonicalId ? repo.packageFor(canonicalId) : null;
    if (latest) repo.installExecutables(latest, done);
    else return done();
  })(done);
};


exports.createSource = function(path, loader) {
  return new Source(path);
};
