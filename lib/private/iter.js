// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see license.txt)
// ==========================================================================

// TODO: Trim out any functions not actually used from here
// This is only supposed to be a nub for 'bootstrap' purposes

var iter = exports;
    
// ..........................................................
// CONTINUABLES
// 


/**
  Useful utility.  Invokes the first continuable then passes the result to 
  the next continuable.  This is really just a way to make your code more 
  readable.  It changes:
  
  {{{
    iter.map(someItems, function(item, done) {
      // make some changes
      return done(null, changedItem); 
    })(function(err, items) {
      iter.reduce(0, items, function(val, item, done) {
        done(null, val + item);
      });
    })(function(err, count) {
      // do something with count
    });
  }}}
  
  To sometime a bit more like:
  
  {{{
    var mapIt = iter.map(someItems, function(item, done) {
      // make some changes
      return done(null, changedItem);
    });
    
    var reduceIt = function(items, done) {
      iter.reduce(0, items, function(val, item, done) {
        done(null, val + item);
      })(done);
    });

    var countIt = iter.chain(mapIt, reduceIt);

    countIt(someItems, function(err, count) {
      // do something with count
    });
    
  }}}
  
*/
iter.chain = function(array) {
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
    var loadit = iter.once(iter.fs.loadFile(pathToFile));

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
iter.once = function(action, context) {
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
  Wraps the passed sync function as a continuable async function. 
*/
iter.async = function(func, context) {
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
iter.map = function(array, fn) {
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
  in parallel, use iter.parallel() instead.
  
  You can pass either an array of continuables to invoke, multiple params
  of continuables or an array and a function. 

*/
iter.each = function(array, fn) {
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
iter.reduce = function(array, initial, fn) {
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
  
  Unlike iter.map() and iter.each() you must pass an array and function.
  
*/
iter.filter = function(array, fn) {
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
iter.find = function(array, fn) {
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
  Just like iter.each() except each item in invoked in parallel with the 
  callback invoked when all items have returned or when one returns with 
  an error. 
  
  Just like iter.each() you can pass an array and function to invoke on each
  item or an array of continuables or multiple params.
  
  The callback will be invoked with only an error or no params when finished.
*/
iter.parallel = function(array, fn) {
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
  Works just like iter.map() except that each item is dispatched in parallel
  instead of in series.  Use this form when you don't care what order the
  items are mapped - just that it completes eventually.
*/
iter.collect = function(array, fn) {
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
  Works just like iter.filter() except that each item is dispatched in parallel
  instead of in series.  Use this form when you don't care what order the
  items are filtered - just that it completed eventually.  Note that the 
  returned filtered array may be out of order from the original array.
*/
iter.filterParallel = function(array, fn) {
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

    // see perf note in iter.collect() - similar problem here
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
