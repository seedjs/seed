// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co = require('./co');
var Sandbox ;

/**
  @file
  
  A Sandbox provides a common space to activate secure modules.  You will 
  often have only one sandbox within an application, though you could create
  as many as you like.  This might be useful, for example, to control access
  for plugins.

  To create a new Sandbox, you must pass in a Loader instance as well.  Most 
  of the time you can obtain a seed from the require.seed property.
  
  A new sandbox will inherit whatever modules are registered on the seed.
  Modules will actually be reinstantiated however, when you require each of 
  them.

  The require statement implemented here knows how to process the following
  kinds of require statements:
  
    require('moduleId') 
      search for moduleId from the top of the current packageId.  If not 
      found, look for a package with the same name and require 
      packageId:index.  If still not found look in node_libraries
      
      Note that you can force a search for node_libraries by naming the 
      default package.
      
    require('./moduleId')
      search for moduleId relative to the current moduleId + packageId
      
    require('packageId:moduleId'[, '1.0.0'])
    require('moduleId', 'packageId'[, '1.0.0'])
      search for the moduleId in the named packageId.  Optionally require the
      named package version number      
      
    require('packageId'[, '1.0.0'])
    require('packageId', '2.1.2beta3');
      just like first variation except this will apply the version number
      as well.  This forces the first param to be treated like a packageId
     
  h2. Canonical Ids
  
  A canonical id reference includes a packageId:moduleId pair along with a 
  version indicator.  The version may be '*' meaning any version is accetable.
  
  @since Seed 1.0
*/


// ..........................................................
// SANDBOX
// 

/**
  @class 

  A sandbox defines a common space where modules can be instantiated and 
  imported.  Each seed comes with a default sandbox where modules are 
  run though you can create additional sandboxes also if you wish.  

  Eventually this will form the basis of a secure system for giving 
  plugins limited access to your application code.

  To create a new sandbox just call the sandbox() method on a seed.  
  This will create a sandbox attached to the named seed.  Once you have 
  created a sandbox, you start running code by calling require().

*/
Sandbox = function Sandbox(id, seed) {
  var allModules = {}, // instantiated module info.
      usedModules = {}, // track exports that have been used already
      modules  = [], // names of instantiated modules
      HASH     = {},
      sandbox  = this,
      nodeRequire = require.nodeRequire || require;

  this.id = id ;
  this.modules = modules;
  this.seed = seed ;

  // private clear method - causes all future requires to reload modules
  function _clear() {
    
    // if one or more module ids are passed, remove them
    var loc = arguments.length, moduleId;
    if (loc>0) {
      while(--loc>=0) {
        moduleId = arguments[loc];
        if (moduleId && allModules[moduleId]) {
          delete allModules[moduleId];
          delete usedModules[moduleId];
          modules.splice(modules.indexOf(moduleId), 1);
        }
      }

    // no arguments passed, clear ALL exports.
    } else {
      allModules = {} ;
      usedModules = {};
      modules.length = 0 ;
    }
  }
  _clear.displayName = 'Sandbox.clear';
  this.clear = _clear;
  
  var requireSync; // complete with sync version later
  
  // this is the core require method.  It will asynchronously fetch a 
  // package if needed.  Invokes the callback 
  function _require(moduleId, packageId, curModuleId, curPackage, done) {
    var req, exports, moduleInfo, factory, idx, exp, pkg;

    // special case - if you ask just for 'seed' or 'seed:index' then always
    // return current seed object since it is equivalent. 
    if ((moduleId === 'seed') || (moduleId === 'seed:index')) {
      return done(null, seed);      
    }

    // substitute package if needed
    if (packageId) {
      idx = moduleId.indexOf(':');
      if (idx>=0) moduleId = moduleId.slice(0, idx);
      moduleId = packageId + ':' + moduleId;
    }
    
    // convert to canonical moduleId reference.
    seed.canonical(moduleId, curModuleId, curPackage, function(err, canonicalId) {
      if (!err && !canonicalId) err = "could not find module " + moduleId;
      if (err) {
        Co.sys.debug('seed.canonical.error: ' + err);
        return done(err, null);
      }

      // see if its already initialized. return if so
      if (exp = allModules[canonicalId]) {

        // save the exports when we return it so it can be checked later...
        exp = exp.exports;
        if (!usedModules[canonicalId]) usedModules[canonicalId] = exp; 
        return done(null, exp || {});
      }

      // not defined...create it
      modules.push(canonicalId);

      // detect internal modules.  These modules should be loaded directly 
      // using the native nodeRequire() since they don't exist anywhere on 
      // disk
      var internalModuleId;
      if (canonicalId.indexOf('::default:')===0) {
        internalModuleId = canonicalId.slice(10);
        if (seed.NATIVE_MODULES.indexOf(internalModuleId)<0) {
          internalModuleId=null;
        } 
      }

      // convert moduleId to just module path - no packageId
      moduleId = canonicalId.slice(canonicalId.indexOf(':',2)+1);
      
      if (internalModuleId) {
        exports = nodeRequire(internalModuleId);
        allModules[canonicalId] = moduleInfo = {
          id: moduleId,
          exports: exports
        };
        usedModules[canonicalId] = exports;
        return done(null, exports);

      } else {
        exports = {};

        // run module factory in seed
        seed.load(sandbox, canonicalId, function(err, factory) {
          if (!err && !factory) err = "could not load module " + canonicalId;
          if (err) return done(err);
          
          allModules[canonicalId] = moduleInfo = {
            id:      moduleId,
            exports: exports,
            pkg:     factory.pkg,
            info:    factory.info
          };
          
          // generate custom require with safe info exposed
          pkg  = factory.pkg;
          req = function(m, p) { return requireSync(m, p, moduleId, pkg); };

          req.async   = function(m, p, done) {
            _require(m, p, moduleId, pkg, done);
            return this;
          };

          req.seed  = seed ;
          req.clear   = _clear;
          req.sandbox = this;
          req.nodeRequire = nodeRequire;
          
          factory.call(exports, req, exports, moduleInfo, factory.__filename, factory.__dirname);

          // detect a circular require.  if another module required this 
          // module while it was still running, that module must have imported 
          // the same exports we ended up with to be consistent.
          exports = moduleInfo.exports;
          exp = usedModules[canonicalId];
          if (exp && exp!==exports) {
            return done("circular require in " + canonicalId);
          }

          usedModules[canonicalId] = exports;
          return done(null, exports);
        });
      }
    });
  }
  
  // add sync version 
  requireSync = function(m, p, moduleId, pkg) {
    var looped   = false,
        unlooped = false,
        error    = null,
        exports  = null;
        
    _require(m, p, moduleId, pkg, function(err, exp) {
      exports = exp;
      error   = err;
      unlooped = true;
      if (looped) process.unloop();
    }); 
    
    looped = true;
    if (!unlooped) process.loop();
    
    if (error) throw error;
    return exports;
  };
  
  // require a module...
  this.require = function(moduleId, packageId, curPackage) { 
    if (packageId && ('string' !== typeof packageId)) {
      curPackage = packageId;
      packageId = undefined;
    }

    return requireSync(moduleId, packageId, null, curPackage);
  };
  
  this.require.displayName = 'Sandbox.require';
  
  this.async = function(moduleId, packageId, curPackage, done) {
    if (done === undefined) {
      if (curPackage === undefined) {
        done = packageId;
        packageId = curPackage = undefined;
      } else {
        done = curPackage;
        curPackage = undefined;
      }
    } 
    return _require(moduleId, packageId, null, curPackage, done);
  };
  this.async.displayName = 'Sandbox.async';
  
};


Sandbox.create = function(id, seed) {
  return new Sandbox(id, seed);
};
Sandbox.create.displayName = 'Sandbox.create';

exports = module.exports = Sandbox;
exports.Sandbox = Sandbox;
