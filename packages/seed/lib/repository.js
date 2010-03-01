// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */

var Co = require('./co'),
    Resource = require('./resource'),
    Config   = require('./config'),
    Package  = require('./package'),
    semver   = require('./semver');
    
var Repository = Co.extend(Resource, {

  LOG_DEBUG: false,
  
  debug: function() {
    if (!this.LOG_DEBUG) return this;
    Co.sys.debug(Array.prototype.slice.call(arguments).join(''));
    return this;  
  },
  
  /**
    Invokes by compatible packages to find all packages with the named 
    packageId.  Invokes callback with an array of packages matching the id
  */
  findPackagePaths: function(packageId, done) {

    // look through the packages directory for a package beginning with 
    // the named package.  note that we can only handle simple package names
    // nothing nested.  i.e. sproutcore, not sproutcore/runtime
    var path = Co.path.join(this.path, 'packages'),
        repo = this;

    this.open(function(err) {
      if (err) return done(err);
      
      Co.fs.readdir_p(path, function(err, dirs) {
        if (err) return done(err);
        if (!dirs) return done(null, []);

        dirs = dirs.filter(function(dir) {
          return dir.match(/(.+)\-[^\-]+\..+$/)[1] === packageId;
        });
        repo.debug('findPackagePaths(',packageId,') => ', dirs.join(','));

        // make into full paths
        dirs = dirs.map(function(dir) { return Co.path.join(path,dir); });
        done(null, dirs);
      });
    });
  },
  
  /**
    Attempts to discover a compatible package installed in the receiver.  
    Invokes the passed callback with the found package instance or null if 
    no match was found.
  
    @param {String} packageId
      the package id
      
    @param {String} vers
      a package version string
      
    @param {Function} callback
      invoked when package is discovered or not
  */
  compatiblePackage: function(packageId, vers, done) {
    this.findPackagePaths(packageId, function(err, paths) {
      if (err) return done(err);
      
      // find newest compatible package based on version
      var ret, retVers ;
      paths.forEach(function(path) {
        var curVersion = path.match(/\-([^\-]+\..+)$/)[1];
        if (semver.compatible(vers, curVersion)) {
          if (!ret || (semver.compare(retVers, curVersion)<0)) {
            ret = path;
            retVers = curVersion;
          }
        }
      });
      
      if (ret) return Package.open(ret, null, done);
      else return done(); // none found
    });
  },
  
  /**
    Get/set a key/value pair from the package configuration.  The package 
    must already be open for this method to work or an exception will be 
    raised.
    
    @param {String} key
      the key in the config to set.  may be dotted to look at nested values
      
    @param {Object} value
      an optional value.  if omitted, acts as a getter.  otherwise, updates
      config.
      
    @returns {Object|Package}
      When called as a getter, returns the named key value.  When called as 
      a setter, returns the receiver.
  */
  info: function(key, value) {
    if (!this.config) return null;
    var ret = this.config.attr(key, value);
    return ((value===undefined) && ('string' === typeof key)) ? ret : this;
  },
  
  // ..........................................................
  // MANAGEMENT
  // 
  
  /**
    This will install a package at the named path into the repository
  */
  install: function(packagePath, done) {
    // TODO: implement install()
  },
  
  /**
    Removes a package instance from the repository
  */
  remove: function(pkg, done) {
    // TODO: implement remove()
  },
  
  /**
    Retrieves all packages in the repository
  */
  packages: Co.once(function(done) {
    var path = Co.path.join(this.path, 'packages');
    Co.fs.readdir_p(path, function(err, dirs) {
      if (err) return done(err);
      if (!dirs) return done(null, []);
      Co.collect(dirs, function(dir, done) {
        dir = Co.path.join(path, dir);
        Package.open(dir, this, done);
      })(done);
    });
  }),
  
  // ..........................................................
  // RESOURCE PRIMITIVES
  // 
  
  readContent: function(done) {
    var configPath = Co.path.join(this.path, 'config.json'),
        repo = this;
        
    Co.path.exists(configPath, function(err, exists) {
      if (err) return done(err);
      if (exists) repo.config = Config.open(configPath, done);
      else repo.config = Config.setup(configPath, done);
    });
  },
  
  writeContent: function(done) {
    if (this.config) this.config.write(done);
    else done();
  },
  
  releaseContent: function(done) {
    if (this.config) this.config.close();
    this.config = null;
    this.packages.reset();
    return done();
  }
  
});

var repositories = {};

/**
  Caches result so only one repo exists.
*/
Repository.open = function(path, done) {
  var ret = repositories[path];
  if (!ret) ret = repositories[path] = new Repository(path);
  ret.open(done);
  return ret ;
};

exports = module.exports = Repository;
exports.Repository = Repository;

