// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  Core defines the low-level utility API for seed.  Basically anything that
  might be platform-dependent should be isolated into a helper function here
*/

var core = exports,
    platform, TIKI_PATH;
    
core.nativeRequire = require.nativeRequire || require;
platform = require('./platform');

core.SEED_ROOT      = platform.SEED_ROOT;
core.NATIVE_MODULES = platform.NATIVE_MODULES;
core.TMPDIR         = platform.TMPDIR;
core.env            = platform.env;
core.args           = platform.args;
core.compile        = platform.compile;
core.http           = platform.http;
core.url            = platform.url;
core.querystring    = platform.querystring;
core.cwd            = platform.cwd;
core.createChildProcess = platform.createChildProcess;


core.fs   = require('./fs');
core.path = require('./path');
core.iter = require('./iter');

// get the tiki runtime here so we don't have to do a funky include everywhere
// due to its odd location need to load as a direct file path
TIKI_PATH = core.path.join(core.SEED_ROOT, 'packages', 'tiki', 'lib', 'tiki');
core.tiki = core.nativeRequire(TIKI_PATH);
core.semver  = core.tiki.semver;
core.isArray = core.tiki.isArray;
core.extend  = core.tiki.extend;
core.once    = core.tiki.once;

/**
  Invokes the passed continuable with any additional params, returning when
  the function completes.  If the continuable results in an error, it will
  be thrown.
*/
core.wait = function(cont, context) {
  
  var LOOP = platform.getLoop();
  
  var looped = false,
      unlooped = false, 
      ret ;

  var args = Array.prototype.slice(arguments, 1);
  args[args.length] = function(err, val) {
    if (err) {
      if ('string' === typeof err) err = new Error(err);
      throw err ;
    } else {
      if (arguments.length>2) {
        ret = Array.prototype.slice.call(arguments, 1);
      } else ret = val;
    }

    unlooped = true;
    if (looped) LOOP.unloop();
  };
  cont.apply(context, args);

  looped = true;
  if (!unlooped) LOOP.loop(); // wait until finished
  return ret;
};

// Takes a sync-method and makes it follow async conventions - catching
// errors and passing them back
core.async = function(cont, context) {
  return function(done) {
    var err, val;
    try {
      val = cont.call(context);
    } catch(e) {
      err = e;
    }
    if (err) return done(err);
    return done(null, val);
  };
};

/**
  Empty handler function.  Pass as a callback when you don't care
*/
core.noop = function() {};

/**
  Returns a callback that will passalong an error only.  
*/
core.err = function(callback) {
  return function(err) { callback(err); };
};

// ..........................................................
// PROMPT FOR INPUT
// 

var listenerAdded = false,
    waiting = [],
    lines   = [];

/**
  Displays a prompt and waits for the user to enter a line.  Invokes callback
  once the user presses return
*/
core.prompt = function(done) {
  core.print('> ');

  // make sure stdio is open
  if (!listenerAdded) {
    listenerAdded = true;
    platform.addStdinListener(function(line) {
      line = line.toString();
      var next = waiting.shift();
      if (next) next(null, line);
      else lines.push(line);
    });
  }
  
  if (lines.length>0) done(null, lines.shift());
  else waiting.push(done);
  
};

core.prompt.done = function() {
  platform.closeStdin();
};

// ..........................................................
// CONSOLE LOGGING
// 

/**
  Print all arguments joined together into a single string without a trailing
  newline
  
  @returns {void}
*/
core.print = function(line) {
  var str = Array.prototype.join.call(arguments, '');
  platform.sys.print(str);
};

/**
  Print all arguments joined together into a single string with a trailing
  newline.
  
  @returns {void}
*/
core.println = function(line) {
  var str= Array.prototype.join.call(arguments, '');
  platform.sys.puts(str);
};

/**
  Immediately outputs debug arguments to the console.
*/
core.debug = function(line) {
  var str = Array.prototype.slice.call(arguments).join();
  platform.sys.debug(str);
};

core.verbose = function() {
  if (core.env.VERBOSE) {
    core.println.apply(core, arguments);
  }
};

core.fail = function() {
  var done = arguments[arguments.length-1];
  var args = Array.prototype.slice.call(arguments, 0, -1);
  core.println.apply(core, args);
  done();
};

/**
  Returns a string representation of the object.
*/
core.inspect = platform.sys.inspect;

// Private array of chars to use
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''); 

/**
  Generates a UUID.  Based on code from:
  
  http://www.broofa.com/Tools/Math.uuid.js
  
  Copyright (c) 2009 Robert Kieffer
  Under MIT license
  
*/
core.uuid = function (len, radix) {
  var chars = CHARS, uuid = [], i;
  radix = radix || chars.length;

  if (len) {
    // Compact form
    for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random()*radix];
  } else {
    // rfc4122, version 4 form
    var r;

    // rfc4122 requires these characters
    uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
    uuid[14] = '4';

    // Fill in random data.  At i==19 set the high bits of clock sequence as
    // per rfc4122, sec. 4.1.5
    for (i = 0; i < 36; i++) {
      if (!uuid[i]) {
        r = 0 | Math.random()*16;
        uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      }
    }
  }

  return uuid.join('').toLowerCase();
};


// ..........................................................
// OBJECT MANIPULATION
// 

// primitive mixin
function _mixin(t, items, skip, augment) {
  
  // copy reference to target object
  var len    = items.length,
      target = t || {},
      idx, options, key, src, copy;

  for (idx=skip; idx < len; idx++ ) {
    if (!(options = items[idx])) continue ;
    for(key in options) {
      if (!options.hasOwnProperty(key)) continue ;

      src  = target[key];
      copy = options[key] ;
      if (target===copy) continue ; // prevent never-ending loop

      // augment means don't copy properties unless already defined
      if (augment && (target[key] !== undefined)) copy = undefined;

      if (copy !== undefined) target[key] = copy ;
    }
  }
  
  return target;
}

/**
  Copy properties onto the first passed param, overwriting any existing 
  properties.
*/
core.mixin = function(t) {
  return _mixin(t, arguments, 1);
};

// TODO: remove?
/**
  Copy properties onto the first passed param only if the property is not 
  already defined.
*/
core.augment = function(t) {
  return _mixin(t, arguments, 1, true);
};

