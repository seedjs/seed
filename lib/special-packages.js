// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */
var core = require('./private/core'),
    tiki = core.tiki,
    Package = require('./package').Package,
    DefaultPackage,
    AnonymousPackage;

var T_UNDEFINED = 'undefined';

// ..........................................................
// DEFAULT PACKAGE
// 

/**
  The default package implements a native require for 'built-in' native 
  modules.  It is used mostly for backwards compatibility.  If you want to
  actually talk to a module on a target platform, best to load the platform
  package instead so someone else can shim-it instead.
*/
DefaultPackage = tiki.Package.extend();
exports.DefaultPackage = DefaultPackage;

DefaultPackage.NATIVE_MODULES = core.NATIVE_MODULES;

DefaultPackage.prototype.init = function(loader) {
  tiki.Package.prototype.init.call(this, '(default)', { name: '(default)'});
  this.loader = loader;
};

DefaultPackage.prototype.findModulePath = function(moduleId) {
  var paths, len, idx;
  
  paths = require.paths;
  if (!paths && (T_UNDEFINED !== typeof process)) paths = process.paths;
  if (!paths) paths = [];
  
  paths = paths.map(function(path) {
    return core.path.join(path, moduleId)+'.js';
  });

  len = paths.length;
  for(idx=0;idx<len;idx++) {
    if (core.fs.exists(paths[idx])) return paths[idx];
  }

  return null;
};

DefaultPackage.prototype.exists = function(moduleId) {

  // the 'seed' module found in the native node.js is for bootstrap only
  // never actually load seed so that it will resolve to a package instead
  if (moduleId === 'seed') return false;

  if (DefaultPackage.NATIVE_MODULES.indexOf(moduleId)>=0) return true;
  return !!this.findModulePath(moduleId);
};

DefaultPackage.prototype.load = function(moduleId) {
  
  var ret, body ;

  // native modules, just use a nativeRequire and then return a factory
  // for it
  if (DefaultPackage.NATIVE_MODULES.indexOf(moduleId)>=0) {
    ret = new tiki.Factory(moduleId, this, function(){});
    ret.call = function(sandbox, module) {
      var exp = core.nativeRequire(this.id);
      module.exports = exp;
      return exp;
    };
    
  // actually read the file off of disk and use normal factory...
  } else {
    var path = this.findModulePath(moduleId);
    if (!path) return null;
    
    body = core.fs.readFile(path);
    if (!body) return null;
    ret = new tiki.Factory(moduleId, this, body);
  }
  
  return ret;
};

// ..........................................................
// ANONYMOUS PACKAGE - loads plain files
// 

AnonymousPackage = Package.extend();
exports.AnonymousPackage = AnonymousPackage;

AnonymousPackage.prototype.init = function(loader) {
  Package.prototype.init.call(this, '(anonymous)', null, null);
  this.packageConfig = { name: '(anonymous)' };
  this.state = Package.OPEN;
  this.loader = loader;
};

AnonymousPackage.prototype.open  = function() {};
AnonymousPackage.prototype.close = function() {};

/**
  Override to look for the actual file path
*/
AnonymousPackage.prototype._findModulePath = function(moduleId, extensions) {
  
  // only handle absolute paths
  if (moduleId[0] !== core.path.SEPARATOR) return null;
  
  var ext  = Package.dummyext(moduleId),
      path = Package.sliceDummyext(moduleId),
      paths = [path],
      idx, len;
      
  extensions.forEach(function(ext) { paths.push(path+ext); });
  len = paths.length;
  
  for(idx=0;idx<len;idx++) {
    if (core.fs.exists(paths[idx])) return paths[idx];
  }
  
  return null;
};
