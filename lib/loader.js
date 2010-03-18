// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals __filename */


var Co = require('./private/co'),
    StringScanner = require('./private/string_scanner'),
    Seed, Loader ;

// states for scanning for pragmas
var START  = 'start',
    PRAGMA = 'pragma',
    BLOCK  = 'block',
    SEMI   = 'semi',
    CODE   = 'code';
    
var QUOTE_REGEX = {
  '"': { inside: /(?:[^"\\]|\\.)*/, stop: /"/ },
  "'": { inside: /(?:[^'\\]|\\.)*/, stop: /'/ }
};


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
    
    Co.fs.readFile(desc.path, function(err, text) {
      if (err) return done(err);
      
      loader.evaluate(text, desc, function(err, factory) {
        if (err) return done(err);
        factory.__filename = desc.path;
        factory.__dirname  = Co.path.dirname(desc.path);
        return done(null, factory);
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
    
    var pragmas = this.pragmas(text, desc),
        loader  = this;
    
    // now we need to add auto imports and exports if needed
    // make sure you call exports before imports since imports needs to 
    // prefix whatever exports adds
    loader.addAutoExports(text, pragmas, desc, function(err, text) {
      if (err) return done(err);
      loader.addAutoImports(text, pragmas, desc, function(err, text) {
        var ret;
        
        try {
          ret = Seed.evaluate(text, desc.path);
        } catch(e) {
          e = 'error during eval for ' + desc.path + ' error: ' + e;
          return done(e);
        }
        
        ret.info = pragmas;
        return done(null, ret);
        
      });
    });
  },

  // ..........................................................
  // PRAGMA PARSING
  // 
  
  /**
    Search module for any pragmas.  Pragmas are free-standing strings 
    appearing before any actual code in the JS file.
  */
  pragmas: function(text, desc) {
    
    // fill in some reasonable defaults
    var ret     = { 
      id: desc.moduleId,
      imports:  [], // declared dependent modules
      exports:  [], // declared export - including those we need to define

      autoExports: [], // exports we need to define in the module
      autoImports: [], // imports we need to define in the module

      modules:  true // should encode as a module - default
    };
    
    var val, importFoo, exportFoo, asBar;
      
    // and look for overrides
    this.scan(text, function(pragma, args) {
      
      switch(pragma.toLowerCase()) {
        
        // use FOO bar <-- set arbitrary pragma
        case 'use':
        
          if (args[0] === 'strict') break; // ignore "use strict";

          // use exports foo 
          // add to list of exported symbols without generating code
          if (args[0] === 'exports') {
            ret.exports = ret.exports.concat(args.slice(1));
            break;
          }

          // use imports foo
          // add to list of imported moduleId's without generating code
          if (args[0] === 'imports') {
            ret.imports = ret.imports.concat(args.slice(1));
            break;
          }
          
          val = args[1]; // force to true/false
          switch(val ? val.toLowerCase() : null) {
            case 'true':
            case 'yes':
              val = true;
              break;
              
            case 'false':
            case 'no':
              val = false;
              break;
            
            case null:
              val = true;
              break;
          }
          ret[args[0]] = val;
          break;
          
        // auto-defined imports
        case 'import':
          // handle import foo as bar
          if ((args.length === 3) && (args[1].toLowerCase() === 'as')) {
            importFoo = args[0]; asBar = args[2];
            ret.imports.push(importFoo);
            ret.autoImports.push({ moduleId: importFoo, symbol: asBar });
            
          // handle import foo bar baz
          } else {
            args.forEach(function(moduleId) {
              ret.imports.push(moduleId);
              ret.autoImports.push({ moduleId: moduleId, symbol: '*' });
            });
          }
          
          break;

        // name a module that should be required without trying to give it 
        // a local symbol.  You could just use require('foo'), but this makes
        // the code a little prettier.
        case 'require':
          args.forEach(function(moduleId) {
            ret.imports.push(moduleId);
            ret.autoImports.push({ moduleId: moduleId }); // no 'symbol'
          });
          break;

        // auto-defined exports
        case 'export':
          // handle export foo as bar
          if ((args.length === 3) && (args[1].toLowerCase() === 'as')) {
            exportFoo = args[0]; asBar = args[2];
            ret.exports.push(asBar);
            ret.autoExports.push({ exp: asBar, symbol: exportFoo });
            
          // handle export foo bar baz
          } else {
            args.forEach(function(symbol) {
              ret.exports.push(symbol);
              ret.autoExports.push({ exp: symbol, symbol: symbol });
            });
          }

          break;

      }
    });
    
    // remove duplicates from imports and exports.
    ret.imports = Co.uniq(ret.imports);
    ret.exports = Co.uniq(ret.exports);
    
    return ret ;
  },
  
  /**
    Scans module text looking for pragmas.  Invokes the passed callback once
    for each pragma found.  The callback should accept two params: the pragma
    command and any additional arguments.
  */
  scan: function(text, block) {
    var loc     = 0,
        len     = text.length,
        state   = START,
        pragmas = [],
        quote, next, line, scanner;

    while((state !== CODE) && (loc<len)) {

      next = text.indexOf('\n',loc);
      if (next<0) next = len;

      // skip empty lines
      if (next === loc) {
        loc = next+1;
        continue;

      // get next line & scanner
      } else {
        line = text.slice(loc, next);
        loc = next+1;
        scanner = new StringScanner(line);
      }
      
      do {

        // skip opening white space on line
        scanner.skip(/\s*/); 
        if (scanner.eos()) break; // end of line

        switch(state) {

          // outside of comment or pragma
          case START:

            // look for the start of a quote.  Puts us inside of a pragma
            quote = scanner.scan(/["']/);
            if (quote) {
              state = PRAGMA;
              break;
            }

            // look for a line comment - just skip rest of line
            if (scanner.scan(/\/\/.*/)) break;

            // start block comment
            if (scanner.scan(/\/\*/)) {
              state = BLOCK;
              break;
            }

            // not whitespace, not a comment or pragma, must be code
            state = CODE;
            break;

          // inside a pragma
          case PRAGMA:
            // NOTE: allows multiple directives in multiline strings
            var directive = scanner.scan(QUOTE_REGEX[quote].inside);
            if (directive) pragmas.push(directive);
            if (scanner.scan(QUOTE_REGEX[quote].stop)) state = SEMI;
            break;

          // pragma ended - wait for a semicolon to terminate
          case SEMI:
            state = scanner.skip(/;/) ? START : CODE;
            break;

          // inside a block comment.  just look for end of block
          case BLOCK:
            scanner.skip(/(?:[^\*]|\*(?!\/))*/);
            if (scanner.scan(/\*\//)) state = START; // found end of block
            break;
            
          // in code state, just scan to end of line
          case CODE:
            scanner.skip(/.*/);
            break; 
            
        }
        
      } while(!scanner.eos()); // until break

    }
    
    // scan complete, invoke callback on each found pragma
    var self = this;
    pragmas.forEach(function(pragma) {
      pragma = self.parsePragma(pragma);
      block(pragma.shift(), pragma);
    });

  },

  parsePragma: function(pragma) {
    return pragma.split(/\s+/);
  },
  
  // ..........................................................
  // AUTO IMPORT/EXPORT
  // 
  
  addAutoImports: function(text, pragmas, desc, done) {
    var imports = pragmas.autoImports;
    if (!imports || imports.length===0) return done(null, text);

    var sandbox = desc.sandbox,
        seed = desc.sandbox.seed,
        cpkg = desc.owner,
        curModuleId = desc.moduleId;
  
    var needsM = false;
    
    // map import definitions to strings to prefix to module
    Co.map(imports, function(info, done) {
      var moduleId = info.moduleId;
      
      // if not symbol is defined, this is just require and return.  No need
      // to lookup the module.
      if (!info.symbol) return done(null, 'require("'+moduleId+'");');  

      // if a symbol is defined, then we can just import to the symbol
      if (info.symbol !== '*') {
        var str = 'var '+info.symbol+'=require("'+moduleId+'");';
        return done(null, str);
      }

      // if the symbol is '*' that means we need to import any exported 
      // symbols directly.  Allowing for a DSL.  Get the exports from the
      // module and name each one.
      
      seed.canonical(moduleId, curModuleId, cpkg, function(err, canonicalId) {
        if (!err && !canonicalId) {
          err = new Error("could not find imported module "+moduleId);
        }
        if (err) return done(err);
        
        seed.load(sandbox, canonicalId, function(err, factory) {
          
          (function(done) {
            var exports = factory.info.exports;

            // no exports - we have to actually require the module to get the
            // list
            if (!exports || (exports.length===0)) {
              sandbox.async(canonicalId, null, cpkg, function(err, exp) {
                if (!err && !exp) {
                  err = new Error("Could not load imported module "+moduleId);
                }
                if (err) return done(err);
                return done(null, Object.keys(exp));
              });
              
            } else return done(null, exports);
            
          // ok we have some exports here.  Generate the output
          })(function(err, exports) {
            if (err) return done(err);
            needsM = true;
            exports = exports.map(function(exp) { return exp+'=$m__.'+exp; });
            exports = exports.join(',');
            exports = '$m__=require("'+moduleId+'"); var '+exports+';';
            return done(null, exports);
          });
        });
      });
      
    })(function(err, prefixes) {
      if (err) return done(err);
      prefixes.push(text);
      text = prefixes.join('');
      if (needsM) text = 'var $m__;'+text;
      return done(null, text);
    });
    
  },
  
  addAutoExports: function(text, pragmas, desc, done) {
    var exports = pragmas.autoExports;
    if (!exports || exports.length===0) return done(null, text);

    // generate prefix
    var prefix = exports.map(function(exp) { return exp.symbol; }).join(',');
    prefix = 'var '+prefix+';';
    
    var postfix = exports.map(function(info) {
      return 'exports.'+info.exp+'='+info.symbol+';';
    }).join('\n');
    
    text = prefix+text+postfix;
    return done(null, text);
  }
  
});

exports = module.exports = new Loader();
exports.Loader = Loader;

