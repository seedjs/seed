// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================


var CORE    = require('./private/core'),
    TIKI    = CORE.tiki,
    Package = require('./package').Package,
    
    special          = require('./special-packages'),
    AnonymousPackage = special.AnonymousPackage,
    DefaultPackage   = special.DefaultPackage,
    
    Seed;

/**
  Seed is the main object that you create when running seed.  It is actually a
  subclass of the tiki loader with some extra methods added to register 
  repositories and such.
  
  When you create a new seed instance, you should pass it a config hash to
  control where it will look for repositories etc.  If you do not pass a 
  config has, it will look for a file at ~/.seeds/config.json or it will
  just use some built-in defaults.
*/
Seed = TIKI.Loader.extend();
exports.Seed = Seed;

Seed.prototype.init = function(config, env, args) {

  this.anonymousPackage = new AnonymousPackage(this);
  this.defaultPackage   = new DefaultPackage(this);
  this.sandbox          = new TIKI.Sandbox(this, env, args);
  this.sources          = [];
  
  var mod = { id: "__seed__", ownerPackage: this.anonymousPackage };
  this.require          = this.sandbox.createRequire(mod);
  this.sandbox.nativeRequire = CORE.nativeRequire;

  TIKI.Loader.prototype.init.call(this, []);
  
  // TODO: Maybe delay opening the config until we actually use it?
  // In practice we'll almost always use it right away...
  if ('string' === typeof config) {
    this.configPath = config;
    config = CORE.fs.exists(config) ? CORE.fs.readJSON(config) : null;
  }
  
  this.config = config || {}; 
  this.normalized = {};
};

// ..........................................................
// CONFIG PROPERTIES
// 

Seed.prototype.DEFAULT_KEYS = 'sources'.split(' ');

Seed.prototype.normalize = function(key, value, writing) {
  if (writing) return value; // for now don't filter writing

  // sources property
  if (key === 'sources') {
    if (!value) value = ['~/.seeds']
    if ('string' === typeof value) value = [value];

    // convert array into array of fully qualified hashes
    value = value.map(function(item) {
      if ('string' === typeof item) {
        item = { path: item, type: 'seed:source' };
      } 
      return item;
    });
  }
  
  return value;
};


Seed.prototype.get = function(key) {
  var ret = this.normalized[key];
  if (ret === undefined) {
    ret = this.normalized[key] = this.normalize(key, this.config[key], false);
  }
  return ret ;
};

Seed.prototype.set = function(key, value) {
  value = this.normalize(key, value, true);
  this.normalized[key] = this.config[key] = value;
  return this;
};

Seed.prototype.getAll = function() {
  var keys = Object.keys(this.config || {});
  this.DEFAULT_KEYS.forEach(function(k) { 
    if (keys.indexOf(k)<0) keys.push(k); 
  }, this);
  
  var ret = {};
  keys.forEach(function(k) { 
    ret[k] = this.get(k);
    if (ret[k]===undefined) delete ret[k];
  }, this);
  
  return ret ;
};

/**
  Write the config file back to disk.
*/
Seed.prototype.writeConfig = function() {
  var path = this.configPath;
  CORE.fs.mkdir_p(CORE.path.dirname(path));
  CORE.fs.writeJSON(path, this.config);
};

/**
  Look for the sources in the config and add any default sources defined
*/
Seed.prototype.addDefaultSources = function() {
  var maker, source, sources = this.get('sources');

  this.seedPackage = this.register(CORE.SEED_ROOT); // add self first
  
  // iterate forward through these items.  This will cause the first item
  // to be searched LAST.
  sources.forEach(function(info) {
    var path = CORE.path.normalize(info.path);
    
    // a missing path may just mean the default value may reference a path
    // we haven't created yet.  Just ignore those for now.
    if (!CORE.fs.exists(path)) return;

    // paths that are defined but not directory means the default is actually
    // misconfigured, so throw an error
    if (!CORE.fs.stat(path).isDirectory()) {
      throw new Error("Source "+path+" is not a directory");
    }

    // get the factory to use for the source.  The only built in one is 
    // the local seed:source type.  You can come up with other types but 
    // you must ensure the related package is loaded first.
    if (info.type === 'seed:source') {
      var sourcePath = CORE.path.join(CORE.SEED_ROOT, 'lib', 'source');
      maker = CORE.nativeRequire(sourcePath);
    } else {
      maker = this.require(info.type);
    }
    
    source = maker.createSource(path, this);
    this.register(source, info.domain);
  }, this);
};

/**
  Start at the named path and walk up until we find a package.json
*/
Seed.prototype.openNearestPackage = function(path) {
  if (path === '.') return null ; // not found
  path = CORE.path.normalize(path); 
  if (CORE.fs.exists(CORE.path.join(path, 'package.json'))) {
    return this.openPackage(path);
  }
  
  return this.openNearestPackage(CORE.path.dirname(path));
};

/**
  Verifies that the named path is a valid package (i.e. has a package.json)
  and if so returns a new package instance.  This method will return a package
  instance you can use to manipulate the package.json and local.json config.
  It cannot be used to actually find and retrieve nested packages and modules.
*/
Seed.prototype.openPackage = function(path) {
  if (!CORE.fs.exists(CORE.path.join(path, 'package.json'))) return null;
  
  var cache = this._directPackages;
  if (!cache) cache = this._directPackages = {};
  if (cache[path]) return cache[path];
  cache[path] =  new Package('::seed'+path, path);
  return cache[path];
} ;


/**
  Add support for opening absolute paths.
*/
Seed.prototype.canonicalPackageId = function(path, vers, workingPackage) {
  if (!vers && (path[0]==='/')) return '::seed'+path;
  else return TIKI.Loader.prototype.canonicalPackageId.apply(this, arguments);
};

/**
  Support opening absolute paths.
*/
Seed.prototype.packageFor = function(canonicalId, workingPackage) {
  if (canonicalId.match(/^::seed/)) {
    var path = canonicalId.slice(6);
    if (path.indexOf(':')>=0) path = path.slice(0, path.indexOf(':'));
    return this.openPackage(path);
    
  } else return TIKI.Loader.prototype.packageFor.apply(this, arguments);
};

// ..........................................................
// REGISTERING SOURCES
// 

/**
  Registers a package or repository with the seed loader.  You can also 
  pass a path and the loader will convert it to a package automatically.
  
  Once a package or repository has been added as a source, then it will be
  searched with calls to require()
  
  @param {String|Package|Repository} packagePath
    Package or repository instance or path to package on disk
    
  @param {Function} callback
    optional callback to invoke when package or repository has been added 
    and is available for discovering new packages.
    
  @returns {Package} created package if added
*/
Seed.prototype.register = function(packagePath, domain) {
  var ret ;
  
  if ('string' === typeof packagePath) {
    
    // accept multiple arguments of strings and join them together
    packagePath = CORE.path.join.apply(CORE.path, arguments);
    packagePath = CORE.path.normalize(packagePath);
    
    ret = new Package('::'+packagePath, packagePath, null);
    
  } else {
    ret = packagePath;
  }

  if (this.sources.indexOf(ret)<0) this.sources.unshift(ret);
  return ret ;
};  
