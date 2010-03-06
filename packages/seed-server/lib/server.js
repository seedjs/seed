// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co = require('seed:co');
var router = require('node-router');
var O_RWX = 511; //0777

// default settings
exports.host = '0.0.0.0'; 
exports.port = '80';
exports.root = '~/.seeds/server';

/**
  Starts the server.  options should include:
  
  * host: host to listen on
  * port: port to listen on
  * root: root to serve from
  
  Calls done when the server exits
*/
exports.start = function(opts, done) {

  // export standard options
  ['host', 'port', 'root'].forEach(function(key) {
    if (opts[key]) exports[key] = opts[key];
  });
  exports.root = Co.path.normalize(exports.root);
      
  Co.sys.puts("Seed Server v" + module.pkg.info('version'));
  Co.sys.puts("Rooted at " + exports.root);
  
  // map resources
  router.resource('seed/users', require('resources/users'), 'json');
  router.resource('seed/tokens', require('resources/tokens'), 'json');
  router.resource('seed/packages', require('resources/packages'), 'json');
  router.resource('seed/assets', require('resources/assets'), 'undefined');

  // cleanup tmp
  var tmppath = Co.path.join(exports.root, 'tmp');
  Co.path.exists(tmppath, function(err, exists) {
    if (exists) Co.fs.rm_r(tmppath, Co.noop);
  });
  
  // start server
  router.listen(Number(exports.port), exports.host);
  return done();
};


/**
  Helper method used by resources to return an error
*/
exports.error = function(res, err) {
  if ('number' === typeof err) res.simpleText(err, '');
  else res.simpleText(503, err.toString());
};

/**
  Helper method used to return a forbidden url
*/
exports.forbidden = function(res, reason) {
  if (!reason) reason = '';
  res.simpleText(403, reason);
};


// Private array of chars to use
var CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split(''); 

/**
  Generates a UUID.  Based on code from:
  
  http://www.broofa.com/Tools/Math.uuid.js
  
  Copyright (c) 2009 Robert Kieffer
  Under MIT license
  
*/
exports.uuid = function (len, radix) {
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

/**
  Reads a JSON file from disk.
*/
exports.readJson = function(path, done) {
  Co.path.exists(path, function(err, exists) {
    if (err) return done(err);
    if (exists) {
      Co.fs.readFile(path, function(err, content) {
        if (err) return done(err);
        try {
          content = JSON.parse(content);
        } catch(e) {
          return done(e);
        }
        return done(null, content);
      });
    } else return done(); // not found
  });
};

/**
  Writes JSON to disk, creating any directories as needed and replacing any
  existing file.
*/
exports.writeJson = function(path, content, done) {
  try {
    content = JSON.stringify(content);
  } catch(e) {
    return done(e);
  }
  
  Co.path.exists(path, function(err, exists) {
    if (err) return done(err);
    
    // if file already exists - delete it then write
    if (exists) {
      Co.fs.rm_r(path, function(err) {
        if (err) return done(err);
        Co.fs.writeFile(path, content, function(err) { done(err); });
      });
      
    // file does not exist - make containing dirs and then write
    } else {

      Co.fs.mkdir_p(Co.path.dirname(path), O_RWX, function(err) {
        if (err) return done(err);
        Co.fs.writeFile(path, content, function(err) { done(err); });
      });
    }
  });
  
};

