// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */
/*jslint evil:true */

var Sandbox = require('./sandbox'),
    Package = require('./package'),
    Co      = require('./co'),
    semver  = require('./semver'),
    Seed ;

// joins a packageId & a moduleId without alloc'ing new memory if possible
var joinPackageCache = {};
function joinPackageId(packageId, moduleId) {
  var moduleIds = joinPackageCache[packageId], ret;
  if (!moduleIds) moduleIds = joinPackageCache[packageId] = {};
  ret = moduleIds[moduleId];
  if (!ret) ret = moduleIds[moduleId] = (packageId + ':' + moduleId);
  return ret ;
}


// standard wrapper around a module.  replace item[1] with a string and join.
var MODULE_WRAPPER = [
  '(function(require, exports, module, __filename, __dirname) {',
  null,
  '\n});\n'];


/**
  This is the core component of the seed package system.  It coordinates 
  mapping a moduleId to a specific module factory function.  This involves 
  expanding the moduleId to include a package identifier, then discovering 
  the package trough one of the registered repositories.
  
  In general, you should only expect to have a single Seed instance in any
  configuration (the instance returned when you require this module).  
  However, you can opt to create a new Seed instance for testing or other 
  purposes. 

  Here is how the default seed.require() works:
  
  {{{
    // same as bar = seed.require('foo:bar');

    var loader = require('loader');
    var bar = loader.sandbox('default').require('foo:bar');
  }}}

  You can also use a loader with a default project package by registering a 
  root package and invoking require from there:
  
  {{{
    var bar = loader.root('path/to/app').require('foo:bar');
  }}}

*/

Seed = Co.extend({
  
  init: function(id) {
    this.id = id;
    this._packages = {};
    this._sandboxes = {};
    this._packagesByCanon = {};
    this._modules = {};
    this.sources  = [];
  },

  NATIVE_MODULES: ['fs', 'path', 'events'],
  
  LOG_DEBUG: false,
  
  debug: function() {
    if (!this.LOG_DEBUG) return this; // do nothing
    Co.sys.debug(Array.prototype.slice.call(arguments).join(''));
    return this;  
  },
  
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
  register: function(packagePath, callback) {
    var ret ;
    
    if ('string' === typeof packagePath) {
      ret = Package.open(packagePath, null); // no owner
      if (this.sources.indexOf(ret)<0) this.sources.push(ret);
      if (callback) ret.open(callback);
      
    } else {
      ret = packagePath;
      if (this.sources.indexOf(ret)<0) this.sources.push(ret);
      if (callback) callback(null, ret);
    }

    return ret ;
  },

  /**
    Returns the sandbox with the given id or a new sandbox if no id is passed.
  */
  sandbox: function(id) {
    if (id === undefined) return Sandbox.create(null, this);
    
    var sandboxes = this._sandboxes;
    if (!sandboxes[id]) sandboxes[id] = Sandbox.create(id, this);
    return sandboxes[id];
  },

  /**
    Require a package/module using the default sandbox.  Most common entry
    point to the seed API.  Only the moduleId parameter is required.
  */
  require: function(moduleId, packageId, curPackage) {
    return this.sandbox('default').require(moduleId, packageId, curPackage);
  },

  /**
    Asynchronously requires package/module using the default sandbox.  
    Invokes the callback [always the last parameter] when finished.
  */
  async: function(moduleId, packageId, curPackage, done) {
    return this.sandbox('default').async(moduleId, packageId, curPackage, done);
  },
  
  // ..........................................................
  // RESOLVING MODULE IDS
  // 

  /**
    Take a relative or fully qualified module name as well as an optional
    base module Id name and returns a fully qualified module name.  If you 
    pass a relative module name and no baseId, throws an exception.
  
    Any embedded package name will remain in-tact.
  
    resolve('foo', 'bar', 'my_package') => 'foo'
    resolve('./foo', 'bar/baz', 'my_package') => 'my_package:bar/foo'
    resolve('/foo/bar/baz', 'bar/baz', 'my_package') => 'default:/foo/bar/baz'
    resolve('foo/../bar', 'baz', 'my_package') => 'foo/bar'
    resolve('your_package:foo', 'baz', 'my_package') => 'your_package:foo'
  
    If the returned id does not include a packageId then the canonical() 
    method will attempt to resolve the ID by searching the default package, 
    then the current package, then looking for a package by the same name.
  
    @param {String} moduleId relative or fully qualified module id
    @param {String} baseId fully qualified base id
    @returns {String} fully qualified name
  */
  resolve: function resolve(moduleId, curModuleId, curPackage) {
    var path, len, idx, part, parts, packageId;

    packageId = curPackage ? curPackage.name() : null;
    
    // if id does not contain a packageId and it starts with a / then 
    // return path so we can make it a default module
    if (moduleId[0]==='/' && moduleId.indexOf(':')<0) return moduleId;

    // must have some relative path components
    if (moduleId.match(/(^\.\.?\/)|(\/\.\.?\/)|(\/\.\.?\/?$)/)) {

      // if we have a packageId embedded, get that first
      if ((idx=moduleId.indexOf(':'))>=0) {
        packageId = moduleId.slice(0,idx);
        moduleId  = moduleId.slice(idx+1);
        path      = []; // path must always be absolute.

      // if no package ID, then use baseId if first component is . or ..
      } else if (moduleId.match(/^\.\.?\//)) {
        if (!curModuleId) {
          throw("curMouleId required to resolve relative: " + moduleId);
        }

        if((idx = curModuleId.indexOf(':'))>=0) {
          if (!packageId) packageId = curModuleId.slice(0,idx);
          curModuleId = curModuleId.slice(idx+1);
        }
        
        path = curModuleId.split('/');
        path.pop(); 

      } else path = [];

      // iterate through path components and update path
      parts = moduleId.split('/');
      len   = parts.length;
      for(idx=0;idx<len;idx++) {
        part = parts[idx];
        if (part === '..') {
          if (path.length<1) throw "invalid path: " + moduleId;
          path.pop();

        } else if (part !== '.') path.push(part);
      }

      moduleId = path.join('/');
      if (packageId) moduleId = joinPackageId(packageId, moduleId);

    }

    return moduleId ;
  },
  
  /**
    Accepts a moduleId and optional baseId.  Returns a canonical
    reference to a module that can be used to actually load the module.
    
    A canonicalId looks like this:
    
    ::/Users/charles/.seeds/packages/sproutcore-1.1.0:models/username
    
    This works much like resolve() except that it will also normalize the 
    packageId according to the following rules if you do not name an explicit
    package:
    
    1. Search for the module in the current package
    3. Treat the id as a packageId.  Look for packageId:index
    
    Also, the default package will be changed to "seed".
    
    @param {String} moduleId the module id
    @param {String} baseId optional base id
    @param {String} packageId optional packageId
    @returns {String} canonical reference
  */
  canonical: function canonical(moduleId, curModuleId, curPackage, done) {
    var resolvedId, action, cache, loader;
    
    if (moduleId.indexOf('::')===0) {
      done(null, moduleId); // already done
      return this;
    }
    
    // normalize moduleId as much as possiblce
    if (!curPackage) curPackage = this._root; // assume root
    resolvedId = this.resolve(moduleId, curModuleId, curPackage);
    this.debug(moduleId, ' resolved to ', resolvedId);

    // avoid lots of headaches if we already know how the story ends
    cache = curPackage ? curPackage.canonicalCache : null;
    if (cache && cache[resolvedId]) {
      done(null, cache[resolvedId]);
      return this;
    }

    // if resolvedId does not contain a packageId then introspect first to
    // decide best way to handle it.  Eventually, this should end up calling
    // action() with a fully qualified [but not yet canonical] id
    if (resolvedId.indexOf(':')<0) {

      // action to invoke later on async
      loader = this;
      action = function(id) { 
        loader._canonical(resolvedId, id, curPackage, done);
      };
      
      this.debug('searching for default module: ', resolvedId);
      this.defaultModuleExists(resolvedId, function(err, exists) {   
        if (exists) {
          loader.debug('found default module: ', resolvedId);
          action(joinPackageId('default', resolvedId));
        } else if (curPackage) {
          loader.debug('not default module, searching curPackage: ', curPackage.name());
          
          curPackage.moduleExists(resolvedId, function(err, exists) {
            loader.debug(exists ? 'FOUND: in current package' : 'Not in current package, assuming this is a package ID');
            if (exists) action(joinPackageId(curPackage.name(), resolvedId));
            else action(joinPackageId(resolvedId, 'index'));
          });
        } else {
          loader.debug('not in default mode and no current package.  assuming this is a package ID');
          action(joinPackageId(resolvedId, 'index'));
        }
      });
      
    } else this._canonical(resolvedId, resolvedId, curPackage, done);

    return this;
  },
  
  /** @private
    Does the hard work to figure out the actual preferred package to load
  */
  _canonical: function(resolvedId, qualifiedId, curPackage, done) {
    
    var idx       = qualifiedId.indexOf(':'),
        packageId = qualifiedId.slice(0,idx),
        moduleId  = qualifiedId.slice(idx+1),
        ret, topPackageId, nestedPackageId;

    // shortcut for default package
    if (packageId === 'default') {
      ret = '::' + qualifiedId;
      
      if (curPackage) {
        if (!curPackage.canonicalCache) curPackage.canonicalCache = {};
        curPackage.canonicalCache[resolvedId] = ret;
      }
      return done(null, ret);
    }
    
    // shortcut when referring to self
    if (curPackage && (curPackage.name() === packageId)) {
      ret = '::' + curPackage.canonicalId() + ':' + moduleId;
      if (!curPackage.canonicalCache) curPackage.canonicalCache = {};
      curPackage.canonicalCache[resolvedId] = ret ;
      return done(null, ret);
    }

    // versioning only applies to the top-level package
    idx = packageId.indexOf('/');
    topPackageId = idx>=0 ? packageId.slice(0,idx) : packageId;
    nestedPackageId = idx>=0 ? packageId.slice(idx+1) : null;

    // vars used by chained options
    var workingPackage = curPackage,
        packagesByCanon = this._packagesByCanon,
        seed = this;
    
    // get the version of this packageId required by the current package 
    // if there is one.  If vers remains null then the latest available
    // package will be used instead. [or whatever is installed in the pkg]
    Co.chain(function(done) {
      seed.debug('finding required version for ', topPackageId);
      if (curPackage) curPackage.requiredVersion(topPackageId, done);
      else return done(); // no version
    },
    
    // search the current package and its owner packages for a nested pkg
    // matching the id first
    function findInWorkingPackage(vers, done) {    
      seed.debug('found version: ', vers, ' searching working package ', (workingPackage ? workingPackage.name() : '(none)'), ' for ', topPackageId);
      
      if (!workingPackage) return done(null, vers, null); // pass along
      
      workingPackage.compatiblePackage(topPackageId, vers, function( err, found) {
        if (err) return done(err);
        if (found) {
          seed.debug('found in ' + found.name());
          return done(null, vers, found);
        } 
        workingPackage = workingPackage.owner; 
        findInWorkingPackage(vers, done);
      });
    },
    
    // if a matching package was not found in the working package, then 
    // look in top-level sources for the package
    function(vers, foundPackage, done) {      
      if (foundPackage) return done(null, foundPackage); // nothing to do

      seed.debug('not found in working packages, searching sources');
      Co.find(seed.sources, function(source, done) {
        if (!source) return done(null, false);

        source.compatiblePackage(topPackageId, vers, function(err, found) {
          if (err) return done(err);
          if (found) foundPackage = found;
          return done(null, !!foundPackage);
        });
        
      })(function(err, src) {  
        if (src) seed.debug('found in repo: ' + src.path);
        else seed.debug('not found in sources');
        done(err, foundPackage); 
      });
    },
    
    // once a matching first package has been found, look for any nested
    // packages
    function(foundPackage, done) {
      if (!nestedPackageId || !foundPackage) return done(null, foundPackage);
      foundPackage.findNestedPackage(nestedPackageId, done);
    },
    
    // finally store any discovered package in the canonical cache to avoid
    // having to go through this again
    function(foundPackage, done) {
      if (!foundPackage) return done(); // nothing found
      
      var ret = '::' + foundPackage.canonicalId() ;
      packagesByCanon[ret] = foundPackage; // map package to canonicalId

      ret = ret + ':' + moduleId ; // add moduleId
      if (curPackage) {
        if (!curPackage.canonicalCache) curPackage.canonicalCache = {};
        curPackage.canonicalCache[resolvedId] = ret;
      }
      done(null, ret);
    })(done);

  },
  
  /**
    Returns the factory function for the named module.  The optional 
    curModuleId and curPackage methods are only required of the passed 
    moduleId is not yet canonical.
    
    {{{
      loader.load('foo:bar', callback);
      loader.load('bar', 'foo/baz', fooPackage, callback);
    }}}
    
    Normally this is all invoked magically by the Sandbox require()
  */
  load: function(sandbox, moduleId, curModuleId, curPackage, done) {
    if (!done && ('function' === typeof curModuleId)) {
      done = curModuleId;
      curModuleId = undefined;
    }
    
    var loader  = this,
        modules = this._modules,
        packagesByCanon = this._packagesByCanon;
    
    this.canonical(moduleId,curModuleId,curPackage,function(err, canonicalId){
      if (!err && !canonicalId) {
        err = "no matching module found for " + moduleId;
      }
      if (err) return done(err, null);

      // look for a cached action.  action should only run once to return 
      // the value.  This way if you try to load the same module more than
      // once they will all return the same instance each time.
      var action = modules[canonicalId];
      if (!action) {
        
        // load from default module
        if (canonicalId.indexOf('::default:')===0) {
          action = Co.once(function(done) {
            var moduleId = canonicalId.slice(10);
            loader.loadDefaultModule(moduleId, done);
          });
          
        // or load from package
        } else {
          action = Co.once(function(done) {
            var idx = canonicalId.indexOf(':', 2), // skip :: at start
                packageId = canonicalId.slice(0, idx),
                moduleId  = canonicalId.slice(idx+1),
                pkg;
                
            pkg = packagesByCanon[packageId]; // should be loaded already
            if (!pkg) {
              return done("package not loaded for " + packageId);
            } else {
              pkg.loadModule(sandbox, moduleId, function(err, factory) {
                if (!factory) {
                  err = new Error("module " + pkg.name() + ':' + moduleId + " not found");
                }
                
                if (factory) factory.pkg = pkg; // required for sandbox
                return done(err, factory);
              });
            }
          });
        }
        
        modules[canonicalId] = action; // cache for later
      }
      
      action(done);
    });
    
    return this;
  },
  
  // ..........................................................
  // PACKAGES
  // 
  
  /**
    Returns an array of all installed packages on the system wrt a current
    package.  This will only include packages that are actually visible to 
    the calling package.
  */
  packageList: function(curPackage, done) {
    if (done === undefined) {
      done = curPackage;
      curPackage = null;
    }
    
    var sources = this.sources.slice();
    if (curPackage) sources.push(curPackage);

    // map/reduce the package list
    Co.map(sources, function(src, done) {
      src.packageList(done);
    })(function(err, packageLists) {
      if (err) return done(err);
      Co.reduce(packageLists, {}, function(ret, list, done) {
        var key;
        
        var iter = function(vers) {
          if (ret[key].indexOf(vers)<0) ret[key].push(vers);
        };
        
        for(key in list) {
          if (!list.hasOwnProperty(key)) continue;
          if (!ret[key]) ret[key] = [];
          list[key].forEach(iter);
        }
        
        done(null, ret);

      })(done);
    });
  },
  
  /**
    Returns a list of package and version numbers that will actually be used
    if you require() from the current package
  */
  preferredPackageList: function(curPackage, done) {
    this.packageList(curPackage, function(err, list) {
      if (err) return done(err);
      var ret = {}, key;
      
      // convert list into array so we can process in parallel
      var iter = function(vers) {
        if (curPackage.packageIsCompatible(key, vers)) {
          if (!ret[key] || (semver.compare(ret[key][0],vers)<0)) {
            ret[key]=[vers]; // array to match packageList
          } 
        }
      };
      
      for(key in list) {
        if (!list.hasOwnProperty(key)) continue;
        list[key].forEach(iter);
      }
      
      done(null, ret);
    });
  },
  
  /**
    Opens a package with the given packageId.  If you pass a version, opens
    that specific version - otherwise uses the version for the current 
    package.
  */
  openPackage: function(packageId, vers, curPackage, done) {
    
    // normalize.  version and curPackage are optional
    if (vers && ('string' !== typeof vers)) {
      done = curPackage;
      curPackage = vers;
      vers = null;
    }
    
    if (done === undefined) {
      done = curPackage;
      curPackage = null; 
    }
    
    // ok, let's find a matching package
    var sources = this.sources.slice();
    if (curPackage) sources.push(curPackage);
    sources = sources.reverse();
    
    var ret = null;
    Co.find(sources, function(source, done) {
      source.compatiblePackage(packageId, vers, function(err, pkg) {
        // must be exact
        if (pkg && vers && (pkg.version() !== vers)) pkg = null;
        ret = pkg;
        done(null, !!pkg);
      });
    })(function(err) { 
      if (err) return done(err);
      ret.open(done);
   });
    
  },
  
  // ..........................................................
  // DEFAULT MODULE
  // 

  // The default package is a pseudo-package that gives you access to any 
  // built-in node libraries.

  /**
    Invokce callback with the absolute path to the named moduleId in the 
    node.js search paths.  If no matching module can be found, passes null.
    
    @param {String} moduleId the module id
    @param {Function} callback callback to invoke
    @returns {void}
  */
  defaultModulePath: function(moduleId, callback) {
    var paths ;
    
    // search all paths for the named module
    if (moduleId[0] === '/') {
      paths = [moduleId, moduleId+'.js'];
    } else {
      paths = process.paths.map(function(path) {
        return Co.path.join(path, moduleId) + '.js';
      });
    }
    
    Co.find(paths, Co.path.exists)(callback);
    return this;
  },

  /**
    Detects whether the named moduleId exists in the "default" module (i.e.
    native libraries installed by node.js).  Invokes callback with bool.
    
    @param {String} moduleId
      the module id
      
    @param {Function} callback
      callback to invoke with signature callback(exists:Boolean)
      
    @returns {Seed} receiver
  */
  defaultModuleExists: function(moduleId, callback) {
    
    // the 'seed' module found in the native node.js is for bootstrap only
    // never actually load seed so that it will resolve to a package instead
    if (moduleId === 'seed') return callback(null, false);

    // note: native modules are labelled as "default" but are handled 
    // specially by the sandbox
    if (this.NATIVE_MODULES.indexOf(moduleId)>=0) {
      callback(null, true);

    // search native load paths for a matching module
    } else {
      this.defaultModulePath(moduleId, function(err, path) {
        callback(err, !!path);
      });
    }
  },

  /**
    Returns the module text for anything in the default module.
  */
  loadDefaultModule: function(moduleId, callback) {
    this.defaultModulePath(moduleId, function(err, path) {
      if (!err && !path) err = ("default:" + moduleId + " not found");
      if (err) callback(err, null);
      Co.fs.readFile(path, function(err, text) {
        if (err) callback(err, null);
        
        var factory = Seed.evaluate(text, path);
        factory.info = { id: moduleId };
        factory.__filename = path;
        factory.__dirname  = Co.path.dirname(path);
        
        callback(null, factory);
      });
    });
  }
    
});


/**
  Takes module text, wraps it in a factory function and evaluates it to 
  return a module factory.  This method does not cache the results so call
  it sparingly.  
  
  @param {String} moduleText the raw module text to wrap
  @param {String} moduleId the module id - used for debugging purposes
  @returns {Function} factory function
*/
Seed.evaluate = function(moduleText, path) {
  var ret;

  // if moduleText begins with #!, slice it off
  if (moduleText.match(/^#!/)) {
    moduleText = moduleText.slice(moduleText.indexOf('\n'));
  }
  
  MODULE_WRAPPER[1] = moduleText;
  
  ret = MODULE_WRAPPER.join('');
  ret = process.compile(ret, path);
  
  MODULE_WRAPPER[1] = null;
  return ret;
};

// ..........................................................
// PUBLIC API
// 

exports = module.exports = Seed;
exports.Seed = Seed;
