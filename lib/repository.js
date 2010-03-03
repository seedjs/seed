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

  // accepts installs from seed
  acceptsInstalls: true,
  
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
  
  infoForPath: function(path) {
    var ret = Co.path.basename(path).match(/^(.+)\-([^\-]+\..+)$/);
    return ret ? [ret[1],ret[2]] : [];
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
    var repo = this;
    this.findPackagePaths(packageId, function(err, paths) {
      if (err) return done(err);
      
      // find newest compatible package based on version
      var ret, retVers ;
      paths.forEach(function(path) {
        var curVersion = repo.infoForPath(path)[1];
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
    Opens a specific package id and version number.  If an exact match is 
    not found, returns and error.
  */
  openPackage: function(packageId, vers, done) {
    var repo = this;
    vers = semver.normalize(vers);
    
    this.findPackagePaths(packageId, function(err, paths) {
      if (err) return done(err);
      
      var ret ;
      paths.forEach(function(path) {
        var curVers = repo.infoForPath(path)[1];
        if (semver.normalize(curVers) === vers) ret = path;
      });
      
      if (ret) return Package.open(ret, null, done);
      else return done(new Error('Not Found'));
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
  
  /**
    Returns a hash with all installed packages and version numbers
  */
  packageList: function(done) {
    var repo = this,
        path = Co.path.join(this.path, 'packages');
    Co.fs.readdir_p(path, function(err, dirs) {
      if (err) return done(err);
      if (!dirs) return done(null, []);
      
      var ret = {};
      dirs.forEach(function(info) {
        info = repo.infoForPath(Co.path.join(path, info));
        var name = info[0], vers = info[1];
        if (!ret[name]) ret[name] = [];
        if (ret[name].indexOf(vers)<0) ret[name].push(vers);
      });
      
      done(null, ret);
    });
  },
  
  // ..........................................................
  // MANAGEMENT
  // 
  
  /**
    Installs a Package into the current repository.
  */
  install: function(pkg, done) {
    var installName = pkg.name() + '-' + pkg.version(),
        srcPath = pkg.path,
        dstPath = Co.path.join(this.path, 'packages', installName),
        repo = this;
        
    Co.sys.debug('installing package '+installName + " from:" + srcPath + " to:" +dstPath);

    var IGNORED = ['.git', '.svn'];
    
    // private method used to collect all the paths to copy from a single
    // directory.  returns the full path
    function collectPaths(path, done) {
      Co.chain(function(done) {
        Co.fs.readdir_p(path, done);
      },
      
      function(filenames, done) {
        var ret = [];
        Co.each(filenames, function(filename, done) {
          if (IGNORED.indexOf(filename)>=0) return done(); //skip
          filename = Co.path.join(path, filename);
          Co.fs.stat(filename, function(err, stats) {
            if (err) return done(); // skip
            if (stats.isDirectory()) {
              collectPaths(filename, function(err, paths) {
                paths.forEach(function(p) { ret.push(p); });
                return done();
              });
            } else {
              ret.push(filename);
              return done();
            }
          });
        })(function(err) { return done(err, ret); });

      })(done);
    }
    
    
    // if path already exists, remove it - we are overwriting it
    Co.chain(function(done) {
      Co.path.exists(dstPath, function(err, exists) {
        if (err) return done(err);
        if (exists) {
          Co.sys.debug('Replacing installed package ' + installName);
          Co.fs.rm_r(dstPath, function(err) { return done(err); });
        } else done();
      });
    },

    // collect list of paths
    function(done) {
      collectPaths(srcPath, done);
    },
    
    // and copy them
    function(paths, done) {
      
      // make relative
      paths = paths.map(function(path) { 
        return path.slice(srcPath.length+1); 
      });
      
      Co.each(paths, function(path, done) {
        Co.sys.debug('Copying ' + path);
        var src = Co.path.join(srcPath, path);
        var dst = Co.path.join(dstPath, path);

        Co.fs.mkdir_p(Co.path.dirname(dst), 0777, function(err) {
          if (err) return done(err);
          Co.fs.cp(src, dst, done);
        });
      })(done);
    },

    // find the newest package installed in the repository to see if it is 
    // this one
    function(done) {
      Co.sys.debug('finding compatible package');
      repo.compatiblePackage(pkg.name(), null, done);
    },
    
    // install any executables if needed
    function(latestPackage, done) {
      Co.sys.debug(latestPackage.version());
      if (latestPackage.version() !== pkg.version()) return done(); // skip
      latestPackage.findExecutables(function(err, execs) {
        if (err) return done(err);
        Co.sys.debug(Co.sys.inspect(execs));
        return done();
      });
      
    // success!
    })(done);
  },
  
  /**
    Removes a package instance from the repository
  */
  remove: function(pkg, done) {
    var installName = pkg.name() + '-' + pkg.version(),
        dstPath = Co.path.join(this.path, 'packages', installName);
    Co.sys.debug('remove: ' + dstPath);
    Co.path.exists(dstPath, function(err, exists) {
      if (!err && !exists) err = new Error(installName + ' not found');
      if (err) return done(err);
      Co.fs.rm_r(dstPath, done);
    });
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

