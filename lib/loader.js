// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals __filename */


var Co = require('./co'),
    Seed, Loader ;

/**
  A loader actually retrieves a module from disk and converts it into a 
  factory function.  When you register new loaders, you provide a module 
  that implements the loadModule() method.  You can extend the Loader class
  if that makes your like easier.
  
  Return null if you can't handle the named path.
*/
Loader = Co.extend({

  /**
    Loads an actual module.  
    
    @param {String} desc
      Describes the module and its loading context.  Contains at least
      path and moduleId properties.
      
    @param {Function} done
      invoke with module factory or null if not handled
      
    @returns {void}
  */
  loadModule: function(desc, done) {
    if (Co.path.extname(desc.path) !== '.js') return done(); // not handled
    
    var loader = this;
    
    // TODO: implement pluggable coders
    Co.fs.readFile(desc.path, function(err, text) {
      if (err) return done(err);
      
      loader.evaluate(text, desc, function(err, factory) {
        if (err) return done(err);
        factory.__filename = desc.path;
        factory.__dirname  = Co.path.dirname(desc.path);
        loader.annotate(factory, text, desc, function(err) {
          if (err) return done(err);
          else return done(null, factory);
        });
      });
    });
  },
  
  /**
    Evaluates the loaded text of the module.  Should return a factory 
    function.  The function will be annotated later as needed.
    
    Default implementation just wraps code in a wrapper.
  */
  evaluate: function(text, desc, done) {
    if (!Seed) Seed = require('./seed');
    
    var ret ;
    try {
      ret = Seed.evaluate(text, desc.path);
    } catch(e) {
      e = 'error during eval for ' + desc.path + ' error: ' + e;
      return done(e);
    }
    
    return done(null, ret);
  },
  
  /**
    Annotates the factory function with additional information that may be
    used by other processors.  Default just sets the moduleId.  Invoke 
    callback when you are finished
  */
  annotate: function(factory, text, desc, done) {
    factory.info = { id: desc.moduleId };
    done();
  }
  
});

exports = module.exports = new Loader();
exports.Loader = Loader;

