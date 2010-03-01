// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  @file
  
  Private continuables-based library used throughout Seed.  Inspired by the Co 
  library.
  
  h2. Actions
  
  An action is simply a function that partially curries the params you 
  pass in, returning a new handler that can invoke a callback.
  
  {{{
    function divide(a, b) {
      return function(callback) {
        process.nextTick(function() {
          callback(null, a/b); // to prove we're async
        });
      };
    }
  }}}
  
  You invoke an action once to get a callback function which you can then
  invoke later with a callback
*/

var Co = exports;

/**
  Empty handler function.  Pass as a callback when you don't care
*/
Co.noop = function() {};

// ..........................................................
// ACTION UTILITIES
// 

/**
  Useful utility.  Invokes the first continuable then passes the result to 
  the next continuable.  This is really just a way to make your code more 
  readable.  It changes:
  
  {{{
    Co.map(someItems, function(item, done) {
      // make some changes
      return done(null, changedItem); 
    })(function(err, items) {
      Co.reduce(0, items, function(val, item, done) {
        done(null, val + item);
      });
    })(function(err, count) {
      // do something with count
    });
  }}}
  
  To sometime a bit more like:
  
  {{{
    var mapIt = Co.map(someItems, function(item, done) {
      // make some changes
      return done(null, changedItem);
    });
    
    var reduceIt = function(items, done) {
      Co.reduce(0, items, function(val, item, done) {
        done(null, val + item);
      })(done);
    });

    var countIt = Co.chain(mapIt, reduceIt);

    countIt(someItems, function(err, count) {
      // do something with count
    });
    
  }}}
  
*/
Co.chain = function(array) {
  if ('function' === typeof array) {
    array = Array.prototype.slice.call(arguments);
  }
  
  var len = array.length;
  return function() {
    var idx = -1,
        done = arguments[arguments.length-1], // get last callback
        firstArgs = Array.prototype.slice.call(arguments, 0, -1);
  
    var loop = function(err) {
      var args;
      
      if (err) return done(err);

      if (++idx >= len) {
        done.apply(null, arguments);
      } else {
        if (arguments.length===1) args = [];
        else args = Array.prototype.slice.call(arguments, 1);

        // make sure the expected number of arguments are passed into the 
        // next item.  This way the callback won't be mistaken for something
        // else
        var nextCallback = array[idx];
        while(args.length < (nextCallback.length-1)) {
          args[args.length]=undefined;
        }

        // set callback as last item and apply
        args[args.length] = loop;
        nextCallback.apply(null, args); // call next item
      }
    };

    firstArgs.unshift(null); // no error!
    loop.apply(null, firstArgs);
  };
};


/**
  Returns a function that will execute the continuable exactly once and 
  then cache the result.  Invoking the same return function more than once
  will simply return the old result. 
  
  This is a good replacement for promises in many cases.
  
  h3. Example
  
  {{{
    // load a file only once
    var loadit = Co.once(Co.fs.loadFile(pathToFile));

    loadit(function(content) { 
      // loads the file
    });
    
    loadit(function(content) {
      // if already loaded, just invokes with past content
    });
    
  }}}
  
  @param {Function} cont
    Continuable to invoke 
    
  @returns {Function} 
    A new continuable that will only execute once then returns the cached
    result.
*/
Co.once = function(action, context) {
  var state = 'pending',
      queue = [],
      args  = null;

  var ret = function(callback) {
    if (!context) context = this;
    
    // cont has already finished, just invoke callback based on result
    switch(state) {
      
      // already resolved, invoke callback immediately
      case 'ready':
        callback.apply(null, args);
        break;

      // action has started running but hasn't finished yet
      case 'running':
        queue.push(callback);
        break;
        
      // action has not started yet
      case 'pending':
        queue.push(callback);
        state = 'running';

        action.call(context, function(err) {
          args  = Array.prototype.slice.call(arguments);
          state = 'ready';
          if (queue) {
            queue.forEach(function(q) { q.apply(null, args); });
            queue = null;
          }
        });
        break;
    }
    return this;
  };

  // allow the action to be reset so it is called again
  ret.reset = function() {
    switch(state) {
      
      // already run, need to reset
      case 'ready': 
        state = 'pending';
        queue = [];
        args  = null;
        break;
        
      // in process - wait until finished then reset again
      case 'running':
        ret(function() { ret.reset(); });
        break;
        
      // otherwise ignore pending since there is nothing to reset
    }
  };
  
  return ret ;
};



/**
  Invokes the passed continuable with any additional params, returning when
  the function completes.  If the continuable results in an error, it will
  be thrown.
*/
Co.wait = function(cont, context) {
  var looped = false,
      unlooped = false, 
      ret ;

  var args = Array.prototype.slice(arguments, 1);
  args[args.length] = function(err, val) {
    if (err) {
      throw err ;
    } else {
      if (arguments.length>2) {
        ret = Array.prototype.slice.call(arguments, 1);
      } else ret = val;
    }

    unlooped = true;
    if (looped) process.unloop();
  };
  cont.apply(context, args);

  looped = true;
  if (!unlooped) process.loop(); // wait until finished
  return ret;
};

/**
  Wraps the passed async continuable in a new function that can be called 
  synchronously.
*/
Co.sync = function(cont, context) {
  return function() {
    var args = Array.prototype.slice(arguments);
    args.unshift(cont);
    return Co.wait.apply(Co, args, context);
  };
};

/**
  Wraps the passed sync function as a continuable async function. 
*/
Co.async = function(func, context) {
  return function() {
    var args = Array.prototype.slice(arguments),
        done = args.pop(), // last param should be a callback
        ret;
        
    try {
      ret = func.apply(context, args);
    } catch(e) {
      return done(e);
    }
    
    return done(null, ret);
  };
};


// ..........................................................
// SERIAL ITERATORS
// 

function eachIter(func, done) {
  func(done);
}

/**
  Returns a continuable that will apply the mapper function to the passed 
  array, passing it to the callback when complete.
  
  The mapper function should have the form:
  
  {{{
    function fn(item, callback) { ... };
  }}}
  
*/
Co.map = function(array, fn) {
  var len ;
  
  // if params are continuables, make into an array 
  if ('function' === typeof array) {
    array = Array.prototype.slice.call(arguments);
    fn = null;
  }
  
  // if no fn is passed, assume array has continuables
  if (!fn) fn = eachIter;
  
  len = array.length;
  return function(done) {
    var idx = -1,
        ret = [];
    
    var loop = function(err, val) {
      if (err) return done(err);
      if (idx>=0) ret[idx] = val; // skip first call
      idx++;
      if (idx>=len) return done(null, ret);
      fn(array[idx], loop);
    };
    
    loop();
  };
};

/**
  Invokes the passed function on each item in the array in order.  This works
  just like forEach() except it is async.  If you can invoke each item 
  in parallel, use Co.parallel() instead.
  
  You can pass either an array of continuables to invoke, multiple params
  of continuables or an array and a function. 

*/
Co.each = function(array, fn) {
  var len ;
  
  // if params are continuables, make into an array 
  if ('function' === typeof array) {
    array = Array.prototype.slice.call(arguments);
    fn = null;
  }
  
  // if no fn is passed, assume array has continuables
  if (!fn) fn = eachIter;
  
  len = array.length;
  return function(done) {
    var idx = -1;
    
    var loop = function(err) {
      if (err) return done(err);
      idx++;
      if (idx>=len) return done(null);
      fn(array[idx], loop);
    };
    
    loop();
  };
};

/**
  Reducer function - takes an input array, an initial value and a reducer
  function.  Applies the reducer to each item on the array, collecting the
  accumulator along the way.  The final reduced value is passed to the 
  callback.

  fn should have signature:
  
  {{{
    fn(currentValue, nextItem, nextItemIndex, doneCallback) { ... }
  }}}
  
*/
Co.reduce = function(array, initial, fn) {
  var len = array.length;
  return function(done) {
    var idx = -1,
        ret = initial;
    
    var loop = function(err, val) {
      if (err) return done(err);
      if (idx>=0) ret = val; // skip first call
      idx++;
      if (idx>=len) return done(null, ret);
      else fn(ret, array[idx], loop);
    };
    
    loop();
  };
};

/**
  Invokes the callback on each item in the array.  Returns an array containing
  only those for which the fn returns true.  
  
  Unlike Co.map() and Co.each() you must pass an array and function.
  
*/
Co.filter = function(array, fn) {
  var len = array.length;
  return function(done) {
    var idx = -1,
        ret = [];
    
    var loop = function(err, val) {
      if (err) return done(err);
      if ((idx>=0) && val) ret.push(array[idx]); // skip first call
      idx++;
      if (idx>=len) return done(null, ret);
      fn(array[idx], loop);
    };
    
    loop();
  };
};


/**
  Invokes callback on array until a match is found.
*/
Co.find = function(array, fn) {
  var len = array.length;
  return function(done) {
    var idx = -1,
        ret = [];
    
    var loop = function(err, val) {
      if (err) return done(err);
      if ((idx>=0) && val) return done(null, array[idx]);
      idx++;
      if (idx>=len) return done(); // not found
      fn(array[idx], loop);
    };
    
    loop();
  };
};

// ..........................................................
// PARALLEL ITERATORS
// 

/**
  Just like Co.each() except each item in invoked in parallel with the 
  callback invoked when all items have returned or when one returns with 
  an error. 
  
  Just like Co.each() you can pass an array and function to invoke on each
  item or an array of continuables or multiple params.
  
  The callback will be invoked with only an error or no params when finished.
*/
Co.parallel = function(array, fn) {
  var len ;
  
  // if params are continuables, make into an array 
  if ('function' === typeof array) {
    array = Array.prototype.slice.call(arguments);
    fn = null;
  }
  
  // if no fn is passed, assume array has continuables
  if (!fn) fn = eachIter;

  return function(done) {
    if (array.length === 0) return done(null, []);
    
    var len = array.length,
        cnt = len,
        cancelled = false,
        idx;

    var tail = function(err) {
      if (cancelled) return; // nothing to do

      if (err) {
        cancelled = true;
        return done(err);
      }

      if (--cnt <= 0) done(); 
    };

    for(idx=0;idx<len;idx++) fn(array[idx], tail);
  };
};

/**
  Works just like Co.map() except that each item is dispatched in parallel
  instead of in series.  Use this form when you don't care what order the
  items are mapped - just that it completes eventually.
*/
Co.collect = function(array, fn) {
  var len ;
  
  // if params are continuables, make into an array 
  if ('function' === typeof array) {
    array = Array.prototype.slice.call(arguments);
    fn = null;
  }
  
  // if no fn is passed, assume array has continuables
  if (!fn) fn = eachIter;

  return function(done) {
    if (array.length === 0) return done(null, []);
    
    var len = array.length,
        cnt = len,
        cancelled = false,
        ret = [],
        idx;

    // note - this impl creates a new callback function for each item in the
    // passed array.  This can be expensive but we assume that allowing the
    // items to excecute in parallel makes up for the added memory cost.
    //
    // still it would be nice to figure out how to implement this without 
    // requiring new functions for each iteration
    var tail = function(idx) {
      return function(err, val) {
        if (cancelled) return; // nothing to do

        if (err) {
          cancelled = true;
          return done(err);
        }

        ret[idx] = val;
        if (--cnt <= 0) done(null, ret); 
      };
    };

    for(idx=0;idx<len;idx++) fn(array[idx], tail(idx));
  };
};

/**
  Works just like Co.filter() except that each item is dispatched in parallel
  instead of in series.  Use this form when you don't care what order the
  items are filtered - just that it completed eventually.  Note that the 
  returned filtered array may be out of order from the original array.
*/
Co.filterParallel = function(array, fn) {
  var len ;
  
  // if params are continuables, make into an array 
  if ('function' === typeof array) {
    array = Array.prototype.slice.call(arguments);
    fn = null;
  }
  
  // if no fn is passed, assume array has continuables
  if (!fn) fn = eachIter;

  return function(done) {
    if (array.length === 0) return done(null, []);
    
    var len = array.length,
        cnt = len,
        cancelled = false,
        ret = [],
        idx;

    // see perf note in Co.collect() - similar problem here
    var tail = function(idx) {
      return function(err, val) {
        if (cancelled) return; // nothing to do

        if (err) {
          cancelled = true;
          return done(err);
        }

        if (val) ret.push(array[idx]);
        if (--cnt <= 0) done(); 
      };
    };

    for(idx=0;idx<len;idx++) fn(array[idx], tail(idx));
  };
};

// ..........................................................
// CLASS EXTENSIONS
// 

// ..........................................................
// OBJECT EXTENSION
// 

// primitive mixin
function _mixin(t, items, skip) {
  
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
      if (copy !== undefined) target[key] = copy ;
    }
  }
  
  return target;
}

/**
  Copy the passed properties onto the first parameter.
  
  @param {Hash} t the target object to mixin to
  @param {Hash..} one or more hashes to mix in
  @returns {Hash} the first parameter
*/
Co.mixin = function(t) {
  return _mixin(t, arguments, 1);
};

// used to beget new objects
var K_ = function() {},
    Kproto_ = K_.prototype;

/**
  Take the named object, beget a new instance using prototype inheritence
  then copy props onto it.
  
  @param {Hash} t the object to beget
  @param {Hash..} hashes optional zero or more hashes to copy props from
  @returns {Hash} the begotten object
*/
var beget = function(t) {
  var ret ;
  
  // primitives cannot beget()
  if ('object' !== typeof(t)) return t ;
  
  K_.prototype = t ;
  ret = new K_();
  K_.prototype = Kproto_;
  
  return _mixin(ret, arguments, 1);
};
Co.beget = beget;

// default __init method.  calls init() if defined.  can be overloaded.
var __init = function(args) {
  var init;
  if (init = this.init) init.apply(this, args);  
};

// generate a new constructor function
function _const() {
  return function() {
    this.__init(arguments);
    return this;
  };
}

/**
  Accepts a constructor function and returns a new constructor the extends 
  the passed value.  The new constructor will pass any constructor methods 
  along to an init() method on the prototype, if it is defined.

  Any additional passed arguments will be copied onto the object.
  
  You can also just pass hashes and we'll make up a constructor for you.
  
  @param {Function} F the constructor function to extend
  @param {Hash..} hashes optional zero or more hashes to copy props from
  @returns {Function} the new subclass
*/
Co.extend = function(F) {
  var Ret = _const(), prot;
   
  if ('function' === typeof F) {
    prot = Ret.prototype = beget(F.prototype);
    if (!prot.__init) prot.__init = __init; // needed for setup
    _mixin(prot, arguments, 1);

  // build a NEW object.
  } else {
    prot = Ret.prototype = _mixin({ __init: __init }, arguments, 0);
  }
  
  prot.constructor = Ret ;
  
  return Ret;
};

// ..........................................................
// CONVERT STANDARD MODULES
// 

Co.fs = Co.beget(require('fs'));
Co.path = Co.beget(require('path'));
Co.sys  = Co.beget(require('sys'));

// patch exists manually so that it includes an error object to make it std
Co.path.exists = function(path, done) {
  Co.fs.stat(path, function(err) {
    done(null,  err ? false : true);
  });
};

/**
  Create the named directory, including any other components in the path
  above it.  If the directory already exists, does nothing.
*/
Co.fs.mkdir_p = function(path, mode, done) {
  path = Co.path.normalize(path);
  
  Co.path.exists(path, function(err, exists) {
    if (err) done(err);
    if (exists) {
      Co.fs.stat(path, function(err, st) {
        if (err) return done(err);
        if (!st.isDirectory()) {
          return done(path + ' is not a directory');
        } else done(path); // nothing to do
      });
      
    } else {
      var base = Co.path.dirname(path);
      if (base === '.') {
        Co.fs.mkdir(path, mode)(done);
      } else {
        Co.fk.mkdir_p(base, mode, function(err) {
          if (err) return done(err);
          Co.fs.mkdir(path, mode, done);
        });
      }
    }
  });

};

/**
  Reads a directory, returning null if the dir does not exists or is not a 
  directory.
*/
Co.fs.readdir_p = function(path, done) {
  Co.path.exists(path, function(err, exists) {
    if (err) return done(err);
    if (!exists) return done();
    Co.fs.stat(path, function(err, stat) {
      if (err) return done(err);
      if (!stat.isDirectory()) return done();
      Co.fs.readdir(path, done);
    });
  });
};

/**
  Copies the first path to the second path.  Works just like cp on the command
  line
*/
Co.fs.cp = function(src, dst, done) {
  src = Co.path.normalize(src);
  dst = Co.path.normalize(dst);
  
  var cmd = ['cp', src, dst].join(' ');
  return Co.sys.exec(cmd, done);
};

/**
  Copies the first path to the second path recursivesly.  Just like cp_r
*/
Co.fs.cp_r = function(src, dst, done) {
  src = Co.path.normalize(src);
  dst = Co.path.normalize(dst);
  
  var cmd = ['cp -r ', src, dst].join(' ');
  return Co.sys.exec(cmd, done);
};

/**
  Moves the source to the destination.  Same as mv
*/
Co.fs.mv = function(src, dst, done) {
  src = Co.path.normalize(src);
  dst = Co.path.normalize(dst);
  
  var cmd = ['mv', src, dst].join(' ');
  return Co.sys.exec(cmd, done);
};

/**
  Deletes the path.  Same as rm
*/
Co.fs.rm = function(src, done) {
  var cmd = ['rm', Co.path.normalize(src)].join(' ');
  return Co.sys.exec(cmd, done);
};

/**
  Deletes the path.  Same as rm -r
*/
Co.fs.rm_r = function(src, done) {
  var cmd = ['rm -r', Co.path.normalize(src)].join(' ');
  return Co.sys.exec(cmd, done);
};

/**
  Deletes the path.  Same as rm -rf
*/
Co.fs.rm_rf = function(src, done) {
  var cmd = ['rm -rf', Co.path.normalize(src)].join(' ');
  return Co.sys.exec(cmd, done);
};

