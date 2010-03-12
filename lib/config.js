// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process __filename */

var Co       = require('./private/co'),
    Resource = require('./resource');

/**
  A Config file provides a uniform interface to access JSON-based config
  files.  It includes the ability to attach a "next" config which will be 
  used to present a "merged" interface to config information.  For example,
  you may load a package.json and a local.json config. setting the package
  config as the "next" config for the local.
  
  To use a config, first you must open it using the Config.open() method.
  Then use the attr() method to read/write keys on the config.  attr() is not
  async.  If your file is not currently open then it will throw an exception.
*/
var Config = Co.extend(Resource, {
  
  init: function(path, next) {
    Resource.prototype.init.call(this,path);
    this.next = next;
  },
  
  /**
    Set to a next config for use when reading
  */
  next: null,
  
  hasChanges: false,
  
  /**
    Should take the passed key/value pair and return a normalized value.  
    You should implement default key handling here.

    @param {String} key
      The info key represented by this value

    @param {Object} value
      The value as found in the info hash or passed to a set

    @returns {Object} value
      The normalized value (possibly the same value passed in)
  */
  normalize: function(key, value) {
    return value;
  },
  
  
  /**
    Read or write an attribute from the current config.  If the config is
    not currently open or writing, throws an exception.
  */
  attr: function(key, value) {
    if ((this.state !== Resource.OPEN) && (this.state !== Resource.WRITING)) {
      throw "Config is not open";
    }
  
    if (key === undefined) return this._allAttrs();
    if (value === undefined) {
      if ('string' === typeof key) {
        return this._readAttr(key);
      } else {
        var attrs = key;
        for(key in attrs) {
          if (!attrs.hasOwnProperty(key)) continue;
          this._writeAttr(key, attrs[key]);
        }
        return this;
      } 
      
    } else return this._writeAttr(key, value);
  },

  _allAttrs: function() {
    var ret = this.next ? Co.beget(this.next._allAttrs()) : {};
    var db = this.db, key;
    for(key in db) { 
      if (!db.hasOwnProperty(key)) continue;
      if (db[key] !== null) ret[key] = this.normalize(key, db[key], 'read');
    }  
    return ret;
  },
  
  _readAttr: function(key) {
    var ret = this.db[key];
    if (!ret && this.next) ret = this.next._readAttr(key);
    return this.normalize(key, ret, 'read');
  },
  
  _writeAttr: function(key, value) {
    this.hasChanges = true;
    this.db[key] = this.normalize(key, value, 'write');
    return this;
  },
  
  // ..........................................................
  // IMPLEMENT RESOURCE API
  // 
  
  // setup new content
  setupContent: function(done) {
    this.db = {};
    done();
  },
  
  // read config from disk
  readContent: function(done) {
    var config = this;
    Co.fs.readFile(this.path, function(err, content) {
      if (err) return done(err);
      
      try {
        
        // strip comments
        content = content.split("\n").map(function(line) {
          return line.match(/^\s*\/\//) ? '' : line;  
        }).join("\n");
        
        config.db = JSON.parse(content);
      } catch(e) {
        e = 'parse error in '+config.path+' error: '+e;
        return done(e);
      }

      return done(); // success!
    });
  },
  
  // write config back to disk
  writeContent: function(done) {
    var content ;
    
    if (!this.hasChanges) return done(); // nothing to do
    this.hasChanges = false;
    
    try {
      content = JSON.stringify(this.db);
    } catch(e) {
      return done(e); // error encoding
    }

    var path = this.path;
    Co.fs.mkdir_p(Co.path.dirname(path), 511, function(err) {
      if (err) return done(err);
      Co.fs.writeFile(path, content, 'w+', done);
    });
  },
  
  // release content to reload
  releaseContent: function(done) {
    this.db = null;
    return done();
  }
  
});

var configs = {};

/**
  Open a new config stored on disk.  If the config does not exist on disk yet
  this will throw an exception.
  
  @param {String} path 
    path to config
    
  @param {Config} next
    optional next config
    
  @param {Function} done
    Optional. Invoked with config instance when config is opened

  @returns {Config} the config object
*/
Config.open = function(path, next, done) {
  // normalize so we can omit next
  if (done===undefined && ('function' === typeof next)) {
    done = next;
    next = null;
  }
  
  var C = this;
  var ret = new C(path);
  ret.open(done);
  return ret; 
};

/**
  Returns a config to setup a new asset on disk.  Also added to open cache
  so future calls to Config.open() will return the same object.

  @param {String} path 
    path to config

  @param {Config} next
    optional next config
  
  @param {Function} done
    Optional. Invoked with config instance when config is setup
  
  @returns {Config} new config
*/
Config.setup = function(path, next, done) {
  // normalize so we can omit next
  if (done===undefined && ('function' === typeof next)) {
    done = next;
    next = null;
  }

  var C = this;
  var ret = new C(path);
  ret.setup(done);
  return ret ;
};

/**
  Detects whether a config exists on disk or not.
*/
Config.exists = function(path, done) {
  Co.path.exists(path, done);
  return this;
};

exports = module.exports = Config;
exports.Config = Config;
