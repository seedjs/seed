// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================


/**
  @file 
  
  Generic in-memory cache API.  Stores simple key/value pairs in an async
  manor.  Currently this uses in-memory cache only but you could replace this
  will memcache
*/

var cache = {};

// gets the named key.  If you provide an alt function, that will be invoked
// if the named key is not cached.  Invokes your done handler when completed.
exports.read = function(key, alt, done) {
  if (done === undefined) {
    done = alt;
    alt = null;
  }

  var ret = cache[key];
  if ((ret === undefined) && alt) {
    alt(function(err, value) {
      if (err) return done(err);
      ret = cache[key] = value;
      return done(null, ret);
    });
  } else return done(null, ret);
};

exports.write = function(key, value, done) {
  cache[key] = value;
  return done();
};

exports.remove = function(key, done) {
  delete cache[key];
  return done();
};
