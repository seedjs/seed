// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process __dirname */

var Resource = require('./resource'),
    Config   = require('./config'),
    Co       = require('./co'),
    semver   = require('./semver'),
    Seed, Package, defaultLoader;

var IncompatibleVersionError = Co.extend(Error, {
  
  init: function(packageId, actual, expected) {
    Error.call(this);
    this.message = "nested package " + packageId + " is incompatible (actual: " + actual + " required: " + expected + ")";
  }

});

Package = Co.extend(Resource, {
  
  init: function(path, owner) {
    Resource.prototype.init.call(this, path);
    this.owner = owner;
  },
  
  /**
    Returns the package id.  If not specified in the package config, this 
    is the directory name.
  */
  name: function() {
    return this.info('name') || Co.path.basename(this.path);
  },

  /**
    Returns the package version.  Derived from the package info or null if 
    none is specified.
  */
  version: function() {
    return this.info('version');
  },
  
  /**
    Returns an id that uniquely represents the package instance.
  */
  canonicalId: function() {
    return this.path;
  },
  
  /**
    Discovers any executables in the package.  These will be installed or 
    removed automatically.
  */
  findExecutables: function(done) {
    var pkg = this;
    Co.chain(function(done) {
      pkg.open(done);
    },

    // get all the binary directories and search them.
    function(pkg, done) {
      var path = pkg.path;
      var bindirs = pkg.info('bin') || ['bin'];
      if ('string' === typeof bindirs) bindirs = [bindirs];
      Co.reduce(bindirs, {}, function(ret, dirname, done) {
        dirname = Co.path.join(path, dirname);

        Co.fs.readdir_p(dirname, function(err, binnames) {
          if (err) return done(err);
          if (binnames) {
            binnames.forEach(function(binname) {
              if (!ret[binname]) ret[binname] = Co.path.join(dirname, binname);
            });
          }
          return done(null, ret);
        });
      })(done);
    })(done);
  },
  
  /**
    Attempts to discover a compatible package installed in the receiver.  
    Invokes the passed callback with the found package instance or null if 
    no match was found.
  
    @param {String} packageId
      the package id
      
    @param {String} vers
      a package version string
      
    @param {Function} done
      invoked when package is discovered or not
  */
  compatiblePackage: function(packageId, vers, done) {
    var pkg = this;
    this.findNestedPackage(packageId, function(err, foundPackage) {
      if (err) return done(err);
            
      // if we couldn't find a nested package, look on self...
      if (!foundPackage && (pkg.name() === packageId)) foundPackage = pkg;
      if (!foundPackage) return done(); // not found
      
      
      // if you have a nested package, it must be compatible or else it
      // is an error
      var foundVers = foundPackage.version();
      if (!semver.compatible(vers, foundVers)) {
        err = new IncompatibleVersionError(packageId, foundVers, vers);
        return done(err, null);
      } else return done(null, foundPackage);
    });
  },  
  
  /**
    Opens the named package.  If the package version does not match exactly
    returns an error.
  */
  openPackage: function(packageId, vers, done) {
    vers = semver.normalize(vers);
    this.compatiblePackage(packageId, null, function(err, pkg) {
      if (!err && !pkg) err = new Error('Not Found');
      if (pkg && (semver.normalize(pkg.version()) !== vers)) {
        err = new Error('Not Found');
      }
      if (err) return done(err);
      else return done(null, pkg);
    });
  },
  
  /**
    return true if the passed packageId and version is compatible
  */
  packageIsCompatible: function(packageId, vers) {
    var required = this.info('dependencies');
    if (required) required = required[packageId];
    return required ? semver.compatible(required, vers) : true;
  },
    
  /**
    Returns all packages directly nested underneath the current package.
    This will open each package, disposing of any packages with duplicate
    ids.
    
    @param {Function} done
      Callback invoked when packages are fully loaded
      
    @returns {void}
  */
  openPackages: Co.once(function(done) {

    var pkg = this;

    // make sure package is open and then get the package info
    Co.chain(function(done) {
      pkg.open(function(err) {
        if (err) return done(err); 
        else return done(null, pkg.path, pkg.info('packages'));
      });
    },
     
    // loop through package names and build array of arrays of dirs existing
    // inside of these directories
    function(base, dirs, done) {
      Co.collect(dirs, function(dir, done) {
        var path = Co.path.join(base, dir);
        Co.fs.readdir_p(path, function(err, dirs) {
          if (err) return done(err);
          if (!dirs) return done(null, []);
          return done(null, dirs.map(function(dir) { 
            return Co.path.join(path, dir);
          }));
        });
        
      })(done);
    },
    
    // take an array of array of directories and merge them into a single 
    // array of directories, excluding .dotfiles
    function(paths, done) {
      Co.reduce(paths, [], function(ret, paths, done) {
        paths.forEach(function(path) {
          if (Co.path.basename(path).indexOf('.')!==0) ret.push(path);
        });
        return done(null, ret);
      })(done);
    },
    
    // take an array of paths and convert to packages
    function(paths, done) {
      Co.collect(paths, function(path, done) {
        Package.open(path, this.context, done); // cur pkg is owner
      })(done);
    },
    
    // look at an array of packages and remove any with duplicate package 
    // names.  first encountered wins
    function(packages, done) {
      var seen = {},
          ret  = [];

      packages.forEach(function(curPackage) {
        var name = curPackage.name();
        
        if (seen[name]) {
          curPackage.close(); // won't be needing you
        } else {
          seen[name] = true;
          ret.push(curPackage);
        }
      });

      return done(null, ret);

    })(done);
    
  }),
  
  /**
    Attempts to discover a nested package with the given packageId name,
    invoking the callback with the package instance or null of no matching 
    package is found.
    
    @param {String} packageId
      the package to attempt to discover
      
    @param {Function} callback
      the callback to invoke with the response

    @returns {void}
  */
  findNestedPackage: function(packageId, done) {
    var idx = packageId.indexOf('/'),
        curPackageId = idx>=0 ? packageId.slice(0,idx) : packageId,
        nextPackageId = idx>=0 ? packageId.slice(idx+1) : null; 
    
    this.openPackages(function(err, packages) {
      if (err) return done(err);
      
      var foundPackage, loc = packages.length;
      while(!foundPackage && (--loc>=0)) {
        foundPackage = packages[loc];
        if (foundPackage.name() !== curPackageId) foundPackage = null;
      }
      
      if (foundPackage && nextPackageId) {
        foundPackage.findNestedPackage(nextPackageId, done);
      } else return done(null, foundPackage);

    });
  },
  
  /**
    Discovers from the package info what version, if any, is required for the
    named packageId.  Inspects the package.json information only.  Invokes 
    callback with the version string or null of no explicit version is 
    required.
    
    @param {String} packageId
      the the package to retrieve version information for
  
    @param {Function} callback
      callback to invoke when complete
      
    @returns {void}
  */
  requiredVersion: function(packageId, done) {
    var pkg = this;
    this.open(function(err) {
      if (err) return done(err);
      var dep = pkg.info('dependencies');
      return done(null, dep ? dep[packageId] : null);
    });
  },

  /**
    Returns a hash of packageId's, including nested package, visible to the
    current package.  The value of each packageId is an array of versions
    for all known packages.
  */
  packageList: function(done) {
    var ret = {};
    ret[this.name()] = [this.version()]; // put in my own
    this.openPackages(function(err, packages) {
      if (err) return done(err);
      packages.forEach(function(pkg) { ret[pkg.name()] = [pkg.version()]; });
      return done(null, ret);
    });
  },

  // ..........................................................
  // MODULE LOADING
  // 

  /**
    Converts a moduleId to a module path to load.  Invokes callback with 
    found path or null if path not found.
    
    @param {String} moduleId 
      the module id to load
      
    @param {Function} callback
      callback to invoke once module path is located
    
    @returns {void}
  */
  findModulePath: function(moduleId, done) {
    var pkg = this;

    // convert moduleId to use platform separators
    var modulePath = Co.path.join.apply(Co.path, moduleId.split('/'));
    
    // make sure we're open so config is up to date
    this.open(function(err) {

      if (err) return done(err);
      
      // get lib dir's and look for first one that exists
      var base = pkg.path,
          dirs = pkg.info('lib'),
          paths = [];

      // expand lib dirs into pull paths
      dirs.forEach(function(dir) {
        dir = Co.path.join(base, dir);
        Package.EXTENSIONS.forEach(function(ext) {
          paths.push(Co.path.join(dir, modulePath) + '.' + ext);
        });
      });

      // load first path that exists
      Co.find(paths, Co.path.exists)(done);
    });
  },

  /**
    Invokes callback with a boolean set to true if the named moduleId exists
    in the current package.
    
    @param {Seed} seed
      the seed requesting whether the module exists or not
      
    @param {String} moduleId 
      the module id to load
      
    @param {Function} callback
      callback to invoke once module is loaded.  passed factory function or 
      error
    
    @returns {void}
  */
  moduleExists: function(moduleId, done) {
    this.findModulePath(moduleId, function(err, path) {
      return done(null, !err && !!path);
    });
  },
  
  /**
    Returns the loaders supported by this package.  Defaults to seed:loader
  */
  loaders: function() {
    return this.info('loaders') || ['seed:loader'];
  },
  
  /**
    Attempts to load the named module from the package.  Returns a factory 
    function annotated with an info hash, __filename, and __dirname.
    
    @param {Sandbox} sandbox
      The sandbox requesting the module.  Can be used to fetch other modules
      as needed
      
    @param {String} moduleId 
      the module id to load
      
    @param {Function} callback
      callback to invoke once module is loaded.  passed factory function or 
      error
    
    @returns {void}
  */
  loadModule: function(sandbox, moduleId, done) {
    var loaders = this.loaders(),
        loading = this._loading,
        pkg     = this, top;
    
    // load the loaders - avoid cyclical references    
    loaders = loaders.map(function(loaderId) {
      var ret ;
      
      // there's always the money in the default loader...
      if (loaderId === 'seed:loader') {
        if (!defaultLoader) defaultLoader = require('./loader');
        return defaultLoader;
      } else {
        if (!loading) {
          top = true; // will need to cleanup when done
          loading = this._loading = [];
        }
        
        if (loading.indexOf(loaderId)>=0) return null ; // skip this time
        loading.push(loaderId);
        ret = sandbox.require(loaderId);
        loading[loading.indexOf(loaderId)] = null;
        return ret ;
      }
    });
    if (top) this._loading = null; // cleanup only at top

    // ok we found the loaders, now let's try to load some modules...
    this.findModulePath(moduleId, function(err, path) {
      if (!err && !path) {
        err = new Error(pkg.name() + ':' + moduleId + ' not found');
      }
      if (err) return done(err);
      
      var desc = {
        path: path,
        moduleId: moduleId,
        owner: this,
        sandbox: sandbox
      };
      
      var factory ;
      
      Co.find(loaders, function(loader, done) {
        loader.loadModule(desc, function(err, loaderFactory) {
          if (err) return done(err);
          else {
            factory = loaderFactory;
            done(null, !!loaderFactory); // stop when not null
          }
        });
        
      })(function(err) { return done(err, factory); }); // ignore found loader
    });
  },

  /**
    Get/set a key/value pair from the package configuration.  The package 
    must already be open for this method to work or an exception will be 
    raised.
    
    @param {String} key
      the key in the config to set.  may be dotted to look at nested values
      
    @param {Object} value
      an optional value.  if omitted, acts as a getter.  otherwise, updates
      config.
      
    @returns {Object|Package}
      When called as a getter, returns the named key value.  When called as 
      a setter, returns the receiver.
  */
  info: function(key, value) {
    if (!this.config) return null;
    var ret = this.config.attr(key, value);
    return ((value===undefined) && ('string' === typeof key)) ? ret : this;
  },
  
  // ..........................................................
  // INSTALL/REMOVE COMMANDS
  // 
  
  /**
    Runs the install command if possible on the package.  Calls done when 
    finished.  This looks for a scripts.install config and runs that.
  */
  setup: function(done) {
    var pkg = this;
    this.open(function(err) {
      if (err) return done(err);
      
      var cmd = pkg.info('scripts');
      if (cmd) cmd = cmd.setup;
      if (cmd) return Co.sys.exec('cd '+pkg.path+'; '+ cmd, done);
      else return done();
    });    
  },
  
  /**
    Runs the remove command if possible on the package.  Calls done when 
    finished.  This looks for a scripts.remove config and runs that.
  */
  teardown: function(done) {
    var pkg = this;
    this.open(function(err) {
      if (err) return done(err);
      
      var cmd = pkg.info('scripts');
      if (cmd) cmd = cmd.teardown;
      if (cmd) return Co.sys.exec('cd '+pkg.path+'; '+ cmd, done);
      else return done();
    });    
  },
  
  // ..........................................................
  // RESOURCE PRIMITIVES
  // 
  
  // create a new package config
  setupContent: function(done) {
    var path = Co.path.join(this.path, 'package.json');
    this.localConfig = null; // start w/o a local config
    this.config = this.packageConfig = Config.setup(path, done);
  },
  
  // look for package and local configs and load them as needed
  readContent: function(done) {
    var pkg = this,
        packagePath = Co.path.join(this.path, 'package.json'),
        localPath   = Co.path.join(this.path, 'local.json'),
        configs = []; // wait till these are open
        
    // get the global config first 
    Package.openGlobalConfig(function(err, globalConfig) {
      if (err) return done(err);

      pkg.globalConfig = globalConfig;
      configs.push(globalConfig);
      
      // look for a general package.json
      Co.path.exists(packagePath, function(err, exists) {

        if (err) return done(err);

        // open package.json if it exists or setup a new empty config if not
        var packageConfig;
        if (exists) packageConfig = Config.open(packagePath, globalConfig);
        else packageConfig = Config.setup(packagePath, globalConfig);
        pkg.packageConfig = pkg.config = packageConfig;
        packageConfig.next = globalConfig;
        configs.push(packageConfig);

        // next look for a local.json and load if exists.  otherwise just 
        // ignore - pkg.config will be default reader
        Co.path.exists(localPath, function(err, exists) {
          if (exists) {
            var localConfig = Config.open(localPath, packageConfig, done);
            pkg.localConfig = pkg.config = localConfig; 
            localConfig.next = packageConfig;
            configs.push(localConfig);
          }
          
          // make sure all configs are open before returning
          Co.parallel(configs, function(c, done) { c.open(done); })(done);
        });
      });
      
    });
  },
  
  writeContent: function(done) {
    var actions = ['packageConfig', 'localConfig'].map(function(config) {
      config = this[config]; //lookup
      return config ? function(done) { config.write(done); } : null;
    }, this);
    
    Co.parallel(actions)(done);
  },
  
  releaseContent: function(done) {
    var pkg = this;
    
    this.openPackages.reset(); // force action to run again next time
    
    Co.parallel(['packageConfig', 'localConfig'], function(key, done) {
      var config = pkg[key];
      pkg[key] = null;
      if (config) config.close();
      else return done();
    })(done);
  }
  
});

// known extensions - may be updated by loaders
Package.EXTENSIONS = ['js'];

var globalConfig;

/**
  Returns the global config file used to provide reasonable defaults for 
  all package configs.  This will open the global config file if needed and
  then invokes the callback once the config file is ready.
*/
Package.openGlobalConfig = function(done) {
  if (!globalConfig) {
    var path = Co.path.join(__dirname, '..', 'default.json');
    path = Co.path.normalize(path);
    
    Co.path.exists(path, function(err, exists) {
      if (!exists) err = "global config not found at " + path;
      if (err) return done(err);
      else globalConfig = Config.open(path, done);
    });
    
  } else globalConfig.open(done);
  return this;
};

var packages = {};

/**
  Creates and attempts to open a package at the named path.  If a package
  already exists at that location, returns the same package.
  
  @param {String} path 
    Path to package to open
    
  @param {Function} callback
    Optional callback invoked when package is opened
    
  @returns {Package} new instance
*/
Package.open = function(path, owner, callback) {
  if ((callback === undefined) && ('function' === typeof owner)) {
    callback = owner;
    owner = undefined;
  }
  
  var ret = packages[path];
  if (!ret) ret = packages[path] = new Package(path, owner);
  ret.open(callback);
  return ret ;
};


exports = module.exports = Package;
exports.Package = Package;
exports.IncompatibleVersionError = IncompatibleVersionError;
