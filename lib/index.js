// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  @file
  
  This is the primary Seed interface exposed when you require('seed') from
  within seed.  It doesn't actually create a new seed runtime; it just makes
  a bunch of common seed-specific utilities available.
*/

var CORE = require('./private/core'),
    seed = exports;

/**
  Path to the root of the seed package directory
*/
seed.SEED_ROOT = CORE.SEED_ROOT;

/**
  @function
  
  In asynchronous platforms, this method will invoke the passed function with
  a callback and then block until the callback is called.  This allows you to
  make async operations run synchronously and visa-versa.

  This method will throw an exception if used on platforms that can't support
  it.
  
  @param {Function} callback
    The callback to invoke.  Should take a single parameter which is another
    function to invoke when the async action has completed.  Pass an optional
    error and return value.
    
  @param {Object} context
    Optional context to use when invoking callback
    
  @returns {Object} return value, if passed, from callback
*/
seed.wait = CORE.wait;
