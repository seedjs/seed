// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var CORE = require('./private/core'),
    TIKI = CORE.tiki,
    Package;
    
var T_STRING = 'string';
    
function dummyext(path) {
  var ext = CORE.path.extname(path), loc;
  if (!ext || (ext.length === 0)) return '';
  
  ext = '//'+ext;
  loc = path.length-ext.length;
  return (path.slice(loc) === ext) ? ext : '';
}

function sliceDummyext(path) {
  var ext = dummyext(path);
  if (!ext || (ext.length===0)) return path;
  return path.slice(0, 0-ext.length);
}


Package = TIKI.Package.extend();
exports.Package = Package;

Package.CLOSED  = 'closed';
Package.OPENING = 'opening';
Package.ERROR   = 'error';
Package.OPEN    = 'open';

Package.dummyext = dummyext;
Package.sliceDummyext = sliceDummyext;

Package.prototype.init = function(id, path, source) {
  TIKI.Package.prototype.init.call(this, id, {});
  this.path = path;
  this.source = this;
  this.normalized = {};
  this.packageConfig = {};
  this.localConfig = {};
};

// ..........................................................
// PACKAGE CONFIG
// 

/**
  For reading from the local domain
*/
Package.LOCAL = 'local'; 

/**
  For reading from the package domain
*/
Package.PACKAGE = 'package';

Package.prototype.normalize = function(key, value, writing) {
  if (writing) return value; // for now don't filter writing
  
  var ret, cur;
  
  if (key === 'directories') {
    if (value) {
      ret = {};
      for(var dirname in value) {
        if (!value.hasOwnProperty(dirname)) continue;
        cur = value[dirname];
        if (!cur) cur = [];
        else if (T_STRING === typeof cur) cur = [cur];
        else if (!CORE.isArray(cur)) {
          throw new Error("directories."+dirname+" is invalid in "+this.id);
        }
        ret[dirname] = cur;
      }
      value = ret;
      
    } else value = {};
    
    if (!value['lib']) value['lib'] = ['lib'];
    if (!value['packages']) value['packages'] = ['packages'];
    if (!value['test'] && value['tests']) value['test'] = value['tests'];
    if (!value['test']) value['test'] = ['test', 'tests', 'spec'];
    if (!value['bin']) value['bin'] = ['bin'];
  
  } else if (key === 'version') {
    if (value) value = CORE.semver.normalize(value);
  }
  
  return value;
};


Package.prototype.getDirnames = function(key, value) {
  var dirs = this.get('directories');
  if (value === undefined) return dirs[key];
  
  if (value && !Array.isArray(value)) value = [value];
  dirs[key] = value;
  this.set('directories', dirs);
  return this;
};


Package.prototype.get = function(key, domain) {
  this.open();
  
  if (domain !== Package.PACKAGE) domain = Package.LOCAL;
  var ret = this.normalized[domain];
  if (ret) ret = ret[key];
  
  if (ret === undefined) {
    
    if ((domain !== Package.PACKAGE) && (this.localConfig[key]!==undefined)){
      ret = this.localConfig[key];
    } else ret = this.packageConfig[key];
    
    if (!this.normalized[domain]) this.normalized[domain] = {};
    ret = this.normalized[domain][key] = this.normalize(key, ret, false);
  }
  return ret ;
};

Package.prototype.set = function(key, value, domain) {
  this.open();
  if (domain !== Package.PACKAGE) domain = Package.LOCAL;
  value = this.normalize(key, value, true);
  
  if (!this.normalized[domain]) this.normalized[domain] = {};
  this.normalized[domain][key] = value;
  
  if (domain == Package.PACKAGE) this.packageConfig[key] = value;
  else this.localConfig[key] = value;
  
  return this;
};

// ..........................................................
// OPEN/CLOSE
// 

Package.prototype.state = Package.CLOSED;

/**
  Opens the package, if it is not already open.  This will read in the 
  package.json as well as a local.json - if it exists - and merge it in.

  @returns {Package} receiver
*/
Package.prototype.open = function() {
  var path;
  
  if (this.state === Package.OPENING) {
    throw new Error("Cannot call Package.open() while opening async");
  }
  
  if (this.state === Package.OPEN) return this;
  this.state = Package.OPENING;
  
  path = CORE.path.join(this.path, 'package.json');
  this.packageConfig = CORE.fs.exists(path) ? CORE.fs.readJSON(path) : {};
  
  path = CORE.path.join(this.path, 'local.json');
  this.localConfig = CORE.fs.exists(path) ? CORE.fs.readJSON(path) : {};

  this.normalized = {}; // reset cache
  
  this.state = Package.OPEN;
  return this;
};

Package.prototype.close = function() {
  if (this.state !== Package.CLOSED) return this;
  this.packageConfig = {};
  this.localConfig = {};
  this.normalized = {};
  this.state = Package.CLOSED;
  return this ;
};

/**
  Asynchronously opens the package, invoking the callback when the package
  is opened or if an error occurs.
  
  @param {Function} done
    The callback to invoke.  Takes an optional error object if an error 
    occurred.
    
  @returns {void}
*/
Package.prototype.ensureOpen = function(done) {
  if (this.state !== Package.CLOSED) return done();
  this.state = Package.OPENING;

  var pkg = this;
  var exit = function(err) {
    pkg.state = Package.ERROR;
    return done(err);
  };

  // read package.json
  (function(next) {
    var path = CORE.path.join(pkg.path, 'package.json');
    CORE.fs.exists(path, function(err, exists) {
      if (err) return done(err);
      if (!exists) return next();
      CORE.fs.readJSON(path, function(err, data) {
        if (!err && !data) err = new Error(path+' is invalid');
        if (err) return exit(err);
        CORE.mixin(pkg.config, data);
        next();
      });
    });
    
  // read local.json
  })(function() {
    
    (function(next) {
      var path = CORE.path.join(pkg.path, 'local.json');
      CORE.fs.exists(path, function(err, exists) {
        if (err) return exit(err);
        if (!exists) return next();
        CORE.fs.readJSON(path, function(err, data) {
          if (!err && !data) err = new Error(path+' is invalid');
          if (err) return exit(err);
          CORE.mixin(pkg.config, data);
          next();
        });
      });
      
    // finalize
    })(function() {
      pkg.state = Package.OPEN;
      done();
    });
  });
  
};

// ..........................................................
// MODULE LOADING
// 

Package.prototype._findModulePath = function(moduleId, extensions) {
  var idx, kind, modulePath, len;

  // get a named path alias
  kind = 'lib';
  if (moduleId[0]==='~') {
    idx = moduleId.indexOf('/');
    if (idx<0) idx = moduleId.length;
    kind = moduleId.slice(1,idx);
    moduleId = moduleId.slice(idx+1);
  }
    
  // convert moduleId to use platform separators
  modulePath = CORE.path.join.apply(CORE.path, moduleId.split('/'));
  
  // get lib dir's and look for first one that exists
  var base = this.path,
      dirs = this.getDirnames(kind),
      paths = [];

  if (!dirs) return null;
  
  // expand lib dirs into pull paths
  dirs.forEach(function(dir) {
    dir = CORE.path.join(base, dir);
    extensions.forEach(function(ext) {
      paths.push(CORE.path.join(dir, modulePath) + ext);
    });
  });

  // load first path that exists
  len = paths.length;
  for(idx=0;idx<len;idx++) {
    if (CORE.fs.exists(paths[idx])) return paths[idx];
  }
  
  return null;
};


Package.prototype.getReaders = function() {
  var ret = this._readers;
  if (!ret) {
    ret = this._readers = { 
      '.js':   { id: 'seed:reader', pkg: null },
      '.node': { id: 'seed:next/native-reader', pkg: null } 
    };
  }
  return ret ;
} ;

Package.prototype.exists = function(moduleId) {
  return !!this._findModulePath(moduleId, Object.keys(this.getReaders()));
};

Package.prototype.load = function(moduleId, sandbox) {
  var path, readers, info, reader;
  
  readers = this.getReaders();
  path = this._findModulePath(moduleId, Object.keys(readers));
  if (!path) return null; // not found!
  
  // get the reader.  use nativeRequire for seed:reader to bootstrap
  info = readers[CORE.path.extname(path)];
  if (!info) info = readers['.js'];
  
  if (info.id === 'seed:reader') {
    var readerPath = CORE.path.join(CORE.SEED_ROOT, 'lib', 'reader');
    reader = CORE.nativeRequire(readerPath);
    
  } else {
    reader = sandbox.require(info.id, info.pkg);
  }
  
  if (!reader) {
    throw new Error('Could not find reader '+info.id+' for module '+moduleId);
  }
  
  return reader.loadModule({
    path:     sliceDummyext(path),
    moduleId: moduleId,
    owner:    this
  });
  
};

// ..........................................................
// NESTED PACKAGE SUPPORT
// 

/**
  Returns a hash of all the packages nested inside of this package, sorted
  by package name.  The returned package objects will not be opened until 
  you actually try to use them.
*/
Package.prototype.nestedPackages = function() {
  if (this._nestedPackages) return this._nestedPackages;
  var ret, byId;
  
  ret = this._nestedPackagesByName = {};
  byId = this._nestedPackagesById;
  if (!byId) byId = this._nestedPackagesById = {};

  // collect packages - don't open them.  just create them
  this.getDirnames('packages').forEach(function(dirname) {
    var path = CORE.path.join(this.path, dirname);
    var dirnames = CORE.fs.readdir_p(path);
    if (!dirnames) return ;
    
    dirnames.forEach(function(packageName) {
      var id, packagePath, pkg;
      
      if (!ret[packageName]) ret[packageName] = [];
      
      id  = this.id+'/'+dirname+'/'+packageName;
      packagePath = CORE.path.join(path,packageName);
      pkg = new Package(id, packagePath, this.source);

      ret[packageName].push(pkg);
      byId[id] = pkg;
      
    }, this);

  },this);
  
  return ret ;
};

Package.prototype.catalogPackages = function() {
  var ret, id, packages;
  
  this.nestedPackages(); // make sure _nestedPackagesById is populated
  ret = [this];
  packages = this._nestedPackagesById;
  for(id in packages) {
    if (!packages.hasOwnProperty(id)) continue;
    ret.push(packages[id]);
  }
  return ret ;
};

Package.prototype.canonicalPackageId = function(packageName, vers) {
  if ((packageName === this.get('name')) && 
      CORE.semver.compatible(vers, this.get('version'))) {
      return this.id;
  }
  
  var packages, len, idx, pkg, ret, rvers, cvers;
  
  packages = this.nestedPackages()[packageName];
  if (!packages) return null;
  
  len = packages.length;
  for(idx=0;idx<len;idx++) {
    pkg = packages[idx];
    cvers = pkg.get('version');

    if (!CORE.semver.compatible(vers, cvers)) continue;
    if (!ret || (CORE.semver.compare(rvers, cvers)<0)) {
      ret = pkg;
      rvers = cvers;
    }
  }
  
  return ret ? ret.id: null ;
};

Package.prototype.packageFor = function(canonicalId) {
  if (canonicalId === this.id) return this;
  
  this.nestedPackages(); // make sure they have loaded once
  var byId = this._nestedPackagesById;
  if (!byId) return null;
  return byId[canonicalId];
};

Package.prototype.ensurePackage = function(canonicalId, done) {
  var pkg = this.packageFor(canonicalId);
  if (pkg) pkg.ensureOpen(done);
  else return done();
};

/**
  Discovers any executables in the package.  These will be installed or 
  removed automatically.
*/
Package.prototype.findExecutables = function(done) {
  var path = this.path;
  var bindirs = this.getDirnames('bin');
  if ('string' === typeof bindirs) bindirs = [bindirs];

  CORE.iter.reduce(bindirs, {}, function(ret, dirname, done) {
    dirname = CORE.path.join(path, dirname);

    CORE.fs.readdir_p(dirname, function(err, binnames) {
      if (err) return done(err);
      if (binnames) {
        binnames.forEach(function(binname) {
          if (!ret[binname]) ret[binname] = CORE.path.join(dirname,binname);
        });
      }
      return done(null, ret);
    });
  })(done);
};

/**
  Copy the receiver package to the named path.  This will copy individual
  files, ignoring any directories that should be skipped (such as .git).
*/
Package.prototype.copy = function(dstRoot, excludeIgnored, done) {
  if ('function' === typeof excludeIgnored) {
    done = excludeIgnored;
    excludeIgnored = true;
  }
  
  if (excludeIgnored === undefined) excludeIgnored = true;

  var ignored, srcRoot, paths, sliceAmt;
  srcRoot = this.path;

  // decide what to ignore. also look add seed:ignore in package.json
  if (excludeIgnored) {
    ignored = this.get('seed:ignore') || [];
    ignored = ignored.concat(['.git', '.svn']);
  } else {
    ignored = [];
  }

  // private method recursively collects all paths to copy from a single 
  // directory. returns array of full paths.
  function collectPaths(path) {
    var filenames, ret = [];
    
    filenames = CORE.fs.readdir_p(path);
    if (!filenames) return ret ;
    
    filenames.forEach(function(filename) {
      if (ignored.indexOf(filename)>=0) return ; // skip
      filename = CORE.path.join(path, filename);
      if (CORE.fs.stat(filename).isDirectory()) {
        collectPaths(filename).forEach(function(p) { ret.push(p); });
      } else {
        ret.push(filename);
      }
    });
    
    return ret ;
  }

  // get paths - make relative to source
  sliceAmt = srcRoot.length+1;
  paths = collectPaths(srcRoot);
  paths = paths.map(function(path) { return path.slice(sliceAmt); });
  
  // copy each path - sync mode
  if (done === undefined) {
    paths.forEach(function(path) {
      var src = CORE.path.join(srcRoot, path);
      var dst = CORE.path.join(dstRoot, path);
      CORE.verbose('Copying ' + path);
      CORE.fs.mkdir_p(CORE.path.dirname(dst), CORE.fs.A_RWX);
      CORE.fs.cp(src, dst);
    });
    
  // copy each patch async
  } else {
    CORE.iter.each(paths, function(path, done) {
      var src = CORE.path.join(srcRoot, path);
      var dst = CORE.path.join(dstRoot, path);

      CORE.verbose('Copying ' + path);
      CORE.fs.mkdir_p(CORE.path.dirname(dst), CORE.fs.A_RWX, function(err) {
        if (err) return done(err);
        CORE.fs.cp(src, dst, done);
      });
      
    })(done);
  }
};

