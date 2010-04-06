// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var core = require('./private/core'),
    tiki = core.tiki,
    Factory ;


/**
  Customized factory that uses the native require() to load module.  This to
  support loading native-code plugins.
*/
Factory = core.extend(tiki.Factory);
exports.Factory = Factory;

/**
  Instantiates a new factory, reading the module contents off of the disk,
  invoking a prepare() method.  The default prepare() does nothing but you
  could override it to do a compiler.
*/
Factory.prototype.init = function(opts) {
  tiki.Factory.prototype.init.call(this, opts.moduleId, opts.owner, '');
  this.path = opts.path;
  return this;
};

/**
  Creates the factory function on demand

  @param sandbox {Sandbox}
    The sandbox the will own the module instance
    
  @param module {Module}
    The module object the exports will belong to
    
  @returns {Hash} exports from instantiated module
  
*/
Factory.prototype.call = function(sandbox, module) {
  var id = this.path.slice(0, 0 - core.path.extname(this.path).length);
  module.exports = core.nativeRequire(id);
  return module.exports;
};

exports.loadModule = function(opts) {
  return new Factory(opts);
};
