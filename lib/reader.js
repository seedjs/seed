// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var core = require('./private/core'),
    tiki = core.tiki,
    jspragma = require('./jspragma'),
    Factory ;


/**
  Customized Factory that knows how to read pragmas among other things.  
  If you want to implement your own reader, you should probably extend from 
  this class and override the prepare() method to pre-process the JS before it
  is loaded.
*/
Factory = core.extend(tiki.Factory);
exports.Factory = Factory;

/**
  Instantiates a new factory, reading the module contents off of the disk,
  invoking a prepare() method.  The default prepare() does nothing but you
  could override it to do a compiler.
*/
Factory.prototype.init = function(opts) {
  var text = core.fs.readFile(opts.path);
  tiki.Factory.prototype.init.call(this, opts.moduleId, opts.owner, text);
  this.path = opts.path;
  
  this.pragmas = { id: this.id };
  if (this.usePragmas) this.pragmas = jspragma.pragmas(text, this.pramgas);

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
  var factory, filename, dirname, req, exp;
  
  factory  = this.prepare(this.factory, sandbox);
  factory  = this.evaluate(factory, sandbox);
  filename = factory.__filename = this.path;
  dirname  = factory.__dirname  = core.path.dirname(this.path);
  
  req = sandbox.createRequire(module);
  exp = module.exports;
  factory.call(exp, req, exp, module, filename, dirname);
  module.pragmas = this.pragmas;
  return module.exports;
};

/**
  Perform any conversion on the text before it is processed for jspragmas.
  This is where you can implement another language compiler.
  
  Default does nothing.
  
  @param {String} text
    The module text 
  
  @returns {String} prepared text - must be JavaScript
*/
Factory.prototype.prepare = function(text) {
  return text;
};

/**
  Evaluates the loaded text of the module.  Should return a factory 
  function.  The function will be annotated later as needed.

  Default implementation just wraps code in a wrapper.
*/
Factory.prototype.evaluate = function(text, sandbox) {
  var pragmas, ret;
  
  // now we need to add auto imports and exports if needed
  // make sure you call exports before imports since imports needs to 
  // prefix whatever exports adds
  if (this.usePragmas) {
    pragmas = this.pragmas;
    text = this.addAutoExports(text, sandbox, pragmas);
    text = this.addAutoImports(text, sandbox, pragmas);
  }

  ret = Factory.compile(text, this.path);
  return ret ;
};

Factory.prototype.usePragmas = true;

// ..........................................................
// AUTO IMPORT/EXPORT
// 

Factory.prototype.addAutoImports = function(text, sandbox, pragmas) {
  var imports = pragmas.autoImports;
  if (!imports || imports.length===0) return text;

  var cpkg = this.pkg, 
      curModuleId = this.id, 
      needsM = false,
      loader = sandbox.loader,
      prefixes;

  // map import definitions to strings to prefix to module
  prefixes = imports.map(function(info) {
    
    var moduleId = info.moduleId, factory, canonicalId;

    // if not symbol is defined, this is just require and return.  No need
    // to lookup the module.
    if (!info.symbol) return 'require("'+moduleId+'");';  

    // if a symbol is defined, then we can just import to the symbol
    if (info.symbol !== '*') {
      return 'var '+info.symbol+'=require("'+moduleId+'");';
    }

    // if the symbol is '*' that means we need to import any exported 
    // symbols directly.  Allowing for a DSL.  Get the exports from the
    // module and name each one.
    canonicalId = loader.canonical(moduleId, curModuleId, cpkg);
    if (!canonicalId) {
      throw new Error("module "+moduleId+' imported in '+this.id+' not found');
    }
    
    factory = loader.load(canonicalId, cpkg);
    exports = factory.pragmas.exports;
    
    // no exports? we have to actually require the module to get the list
    if (!exports || (exports.length === 0)) {
      exports = sandbox.require(canonicalId, curModuleId, cpkg);
      exports = Object.keys(exports);
    }
    
    needsM = true;
    exports = exports.map(function(exp) { return exp+'=$m__.'+exp; });
    exports = exports.join(',');
    exports = '$m__=require("'+moduleId+'"); var '+exports+';';
    return exports;
  });

  prefixes.push(text);
  text = prefixes.join('');
  if (needsM) text = 'var $m__;'+text;
  return text;
};

/**
  Appends any automatic exports based on jspragmas.
*/
Factory.prototype.addAutoExports = function(text, sandbox, pragmas) {
  var exports = pragmas.autoExports;
  if (!exports || exports.length===0) return text;

  // generate prefix
  var prefix = exports.map(function(exp) { return exp.symbol; }).join(',');
  prefix = 'var '+prefix+';';

  var postfix = exports.map(function(info) {
    return 'exports.'+info.exp+'='+info.symbol+';';
  }).join('\n');

  text = prefix+text+'\n'+postfix;
  return text;
};

exports.loadModule = function(opts) {
  return new Factory(opts);
};


// ..........................................................
// EVALUATE
// 

// standard wrapper around a module.  replace item[1] with a string and join.
var MODULE_WRAPPER = [
  '(function(require, exports, module, __filename, __dirname) {',
  null,
  '\n});\n'];
  
/**
  Takes module text, wraps it in a factory function and evaluates it to 
  return a module factory.  This method does not cache the results so call
  it sparingly.  
  
  @param {String} moduleText the raw module text to wrap
  @param {String} moduleId the module id - used for debugging purposes
  @returns {Function} factory function
*/
Factory.compile = function(moduleText, path) {
  var ret;

  // if moduleText begins with #!, slice it off
  if (moduleText.match(/^#!/)) {
    moduleText = moduleText.slice(moduleText.indexOf('\n'));
  }
  
  MODULE_WRAPPER[1] = moduleText;
  
  ret = MODULE_WRAPPER.join('');
  ret = core.compile(ret, path);
  
  MODULE_WRAPPER[1] = null;
  return ret;
};
exports.compile = Factory.compile;
