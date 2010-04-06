// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  Implements the jspragmas spec
*/

var StringScanner;

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

// returns a new array with only uniq items
function uniq(ary) {
  var hash = {};
  ary.forEach(function(i) { hash[i] = true; });
  return Object.keys(hash);
}

function parsePragma(pragma) {
  return pragma.split(/\s+/);
}

/**
  Scans module text looking for pragmas.  Invokes the passed callback once
  for each pragma found.  The callback should accept two params: the pragma
  command and any additional arguments.
*/
function scan(text, parser, block) {
  var loc     = 0,
      len     = text.length,
      state   = START,
      pragmas = [],
      quote, next, line, scanner;

  if (parser && !block) {
    block = parser;
    parser = null;
  }
  
  if (!parser) parser = parsePragma;
  
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
  pragmas.forEach(function(pragma) {
    pragma = parser(pragma);
    block(pragma.shift(), pragma);
  });

}
exports.scan = scan;


/**
  Search text for any pragmas.  Pragmas are free-standing strings 
  appearing before any actual code in the JS file.
  
  @param {String} text
    The text to parse
    
  @param {Hash} desc
    Starting state of the pragmas.
*/
function pragmas(text, desc, parser) {
    
  // fill in some reasonable defaults
  var ret = desc || {};
  if (!ret.imports) ret.imports = []; // declared dependent modules
  if (!ret.exports) ret.exports = []; // declared export
  if (!ret.autoExports) ret.autoExports = []; // exports to define
  if (!ret.autoImports) ret.autoImports = []; // imports to define
  if (!ret.modules) ret.modules = true; // encode as a module
  if (!ret.loader)  ret.loader  = true; // use a loader for browser
  
  var val, importFoo, exportFoo, asBar;
    
  // and look for overrides
  scan(text, parser, function(pragma, args) {
    
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
  ret.imports = uniq(ret.imports);
  ret.exports = uniq(ret.exports);
  
  return ret ;
}
exports.pragmas = pragmas;

// ..........................................................
// StringScanner
// 

StringScanner = function(str) {
  this.init(str);
};

StringScanner.prototype = {
  
  init: function(str) {
    this.str = str;
    this.loc = 0;
    this.length = 0;
  },
  
  _check: function(regex) {
    var sub, ret;
    if (this.eos()) return null; // at end of string
    sub = this.loc===0 ? this.str : this.str.slice(this.loc);
    ret = regex.exec(sub);
    return (ret && ret.index === 0) ? ret : null;
  },

  check: function(regex) {
    var ret, lim, idx;
    
    ret = this._check(regex);

    // remove previously saved items
    lim = this.length;
    for(idx=0;idx<lim;idx++) delete this[idx];

    // save matches
    if (ret) {
      lim = this.length = ret.length;
      for(idx=0;idx<lim;idx++) this[idx] = ret[idx];
    } 
    
    return ret ? ret[0] : null;
  },
  
  scan: function(regex) {
    var ret = this.check(regex);
    if (ret) this.loc+=ret.length;
    //Co.debug('check('+regex+')='+(ret ? ret.length : 0)+' loc='+this.loc);
    return ret ;
  },
  
  skip: function(regex) {
    var ret = this._check(regex);
    if (ret) ret = ret[0];
    if (ret) this.loc += ret.length;
    //Co.debug('skip('+regex+')='+(ret ? ret.length : 0)+' loc='+this.loc);
    return this;
  },
  
  eos: function() {
    return this.loc >= this.str.length;
  }
  
};
exports.StringScanner = StringScanner;

