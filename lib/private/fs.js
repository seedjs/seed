// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see license.txt)
// ==========================================================================
/*globals process */

var core = require('../private/core'),
    platform = require('./platform'),
    PATH = platform.path,
    FS   = platform.fs,
    SYS  = platform.sys,
    CS_ITER = require('./iter'),
    CS_PATH = require('./path'),
    fs = exports;

// ..........................................................
// STANDARD PERMISSIONS OPTIONS
// 

fs.U_READ  = 256; // 0400
fs.U_WRITE = 128; // 0200
fs.U_EXEC  = 64;  // 0100
fs.U_RW    = 384; // 0600
fs.U_RWX   = 488; // 0700

fs.G_READ  = 32;  // 0040
fs.G_WRITE = 16;  // 0020
fs.G_EXEC  = 8;   // 0080
fs.G_RW    = 48;  // 0060
fs.G_RWX   = 56;  // 0070

fs.O_READ  = 4;   // 0004
fs.O_WRITE = 2;   // 0002
fs.O_EXEC  = 1;   // 0001
fs.O_RW    = 6;   // 0006
fs.O_RWX   = 7;   // 0007

fs.A_READ  = 292; // 0444
fs.A_WRITE = 146; // 0222
fs.A_EXEC  = 73;  // 0111
fs.A_RW    = 438; // 0666
fs.A_RWX   = 511; // 0777

// ..........................................................
// FUNCTIONS
// 

/**
  Returns true if path exists or invokes callback if one is passed.  Callback
  should follow the standard continuable API
  
  @param {String} path
    Path to search for
    
  @param {Function} done
    Callback invoked with result.  If you do not pass a callback, this method
    will be invoked synchronously instead
*/
fs.exists = function(path, done) {
  if (done === undefined) {
    var exists = true;
    
    try {
      FS.statSync(path);
    } catch(e) {
      exists = false;
    }
    return exists;
  } else {
    FS.stat(path, function(err, st) {
      return done(null, err ? false : true);
    });
  }
};

/**
  Executes a child process.  Invokes the callback or returns the resulting
  output.
*/
fs.exec = function(command, echo, done) {
  if ('function' === typeof echo) {
    done = echo;
    echo = false;
  }
  
  if (done === undefined) {
    return core.wait(function(done) { platform.exec(command, echo, done); });
  } else platform.exec(command, echo, done);
};

fs.rename = function(src, dst, done) {
  if (done === undefined) return FS.renameSync(src, dst);
  else FS.rename(src, dst);
};
fs.mv = fs.rename;

fs.copy = function(src, dst, done) {
  src = CS_PATH.normalize(src);
  dst = CS_PATH.normalize(dst);
  
  var cmd = ['cp', src, dst].join(' ');
  return fs.exec(cmd, done);
};
fs.cp = fs.copy;

fs.cp_r = function(src, dst, done) {
  src = CS_PATH.normalize(src);
  dst = CS_PATH.normalize(dst);
  
  var cmd = ['cp -r', src, dst].join(' ');
  return fs.exec(cmd, done);
};

fs.truncate = function(fd, len, done) {
  if (done === undefined) return FS.truncateSync(fd, len);
  else FS.truncate(fd, len, done);
};

fs.chmod = function(path, mode, done) {
  if (done === undefined) return FS.chmodSync(path, mode);
  else FS.chmod(path, mode, done);
};

fs.stat = function(path, done) {
  if (done === undefined) return FS.statSync(path);
  else FS.stat(path, done);
};

fs.lstat = function(path, done) {
  if (done === undefined) return FS.lstatSync(path);
  else FS.lstat(path, done);
};

fs.link = function(path, done) {
  if (done === undefined) return FS.linkSync(path);
  else FS.link(path, done);
};
fs.ln = fs.link;

fs.symlink = function(path, done) {
  if (done === undefined) return FS.symlinkSync(path);
  else FS.symlink(path, done);
};
fs.ln_s = fs.symlink;

fs.readlink = function(path, done) {
  if (done === undefined) return FS.readlinkSync(path);
  else FS.readlink(path, done);
};

fs.realpath = function(path, done) {
  if (done === undefined) return FS.realpathSync(path);
  else FS.realpath(path, done);
};

fs.unlink = function(path, done) {
  if (done === undefined) return FS.unlinkSync(path);
  else FS.unlink(path, done);
};
fs.rm = fs.unlink;

/**
  Recusively delete files.
*/
fs.rm_r = function(path, done) {
  path = CS_PATH.normalize(path);
  var cmd = 'rm -r '+path;
  return fs.exec(cmd, done);
};

fs.rmdir = function(path, done) {
  if (done === undefined) return FS.rmdirSync(path);
  else FS.rmdir(path, done);
};

fs.rmdir_p = function(path, done) {
  if (done === undefined) {
    if (fs.exists(path)) return FS.rmdirSync(path);
    else return false;
  } else {
    fs.exists(path, function(err, exists) {
      if (err) return done(err);
      if (exists) return FS.rmdir(path, done);
      else return done();
    });
  }
};

fs.mkdir = function(path, mode, done) {
  if (done === undefined) return FS.mkdirSync(path, mode);
  else FS.mkdir(path, mode, done);
};

/**
  Safely make any directories in the path that do not yet exist.
*/
fs.mkdir_p = function(path, mode, done) {
  if (done === undefined) {
    if (!fs.exists(path)) {
      var dirname = CS_PATH.dirname(path);
      if (dirname !== '.') fs.mkdir_p(dirname, mode);
      return FS.mkdirSync(path, mode);
    }
    
    else return false;
  } else {
    fs.exists(path, function(err, exists) {
      if (err) return done(err);
      if (!exists) {
        var dirname = CS_PATH.dirname(path);
        if (dirname !== '.') {
          fs.mkdir_p(dirname, mode, function(err) {
            if (err) return done(err);
            FS.mkdir(path, mode, done);
          });

        } else {
          FS.mkdir(path, mode, done);
        }
      } else return done();
    });
  }
};

fs.readdir = function(path, done) {
  if (done === undefined) return FS.readdirSync(path);
  else FS.readdir(path, done);
};

/**
  Read the directory contents.  If the directory does not exist, returns an
  empty array.
*/
fs.readdir_p = function(path, done) {
  if (done === undefined) {
    if (fs.exists(path)) return FS.readdirSync(path);
    else return [];
    
  } else {
    fs.exists(path, function(err, exists) {
      if (err) return done(err);
      if (exists) return FS.readdir(path, done);
      else return done(null, []);
    });
  }
};



function _globSync(path) {
  var filenames = fs.readdir_p(path);
  var ret = [];
  filenames.forEach(function(filename) {
    var curPath = CS_PATH.join(path, filename);
    
    // search inside directories
    if (fs.stat(curPath).isDirectory()) {
      var children = _globSync(curPath);
      children.forEach(function(pname) {
        ret.push(CS_PATH.join(filename, pname));
      });
      
    // or just add file itself
    } else ret.push(filename)
    
  });
  return ret ;
}

function _globAsync(path, done) {
  fs.readdir_p(path, function(err, filenames) {
    if (err || !filenames) return done(err);

    CS_ITER.reduce(filenames, [], function(ret, filename, done) {
      var curPath = CS_PATH.join(path, filename);
      
      fs.stat(curPath, function(err, stats) {
        if (err) return done(err); // shouldn't happen since file exists
        if (stats.isDirectory()) {
          return _globAsync(curPath, function(err, paths) {
            if (err) return done(err);
            
            paths.forEach(function(pname) { 
              ret.push(CS_PATH.join(filename, pname));
            });
            
            return done(null, ret);
          });
          
        } else {
          ret.push(filename);
          return done(null, ret);
        }
      });
      
    })(done);
  });
}

function _filterGlob(paths, filterExpr) {
  if ('string' === typeof filterExpr) fitlerExpr = new RegExp(filterExpr);
  return paths.filter(function(path) {
    return filterExpr.test(path);
  });
}

/**
  Return ALL the files under a given directory optionally matching against
  a regular expression.
  
  *** NOTE ***
    This function will recurse if you give a path to a directory that contains
    sub directories, so I omitted the normal '**' glob pattern.
    
  @param path [path to a dir] -- Cs.path.normalize() is your friend
  @param done [callback function]
  
*/
fs.glob = function(path, done) {
  if (done === undefined) return _globSync(path);
  else _globAsync(path, done);
};

fs.close = function(fd, done) {
  if (done === undefined) return FS.closeSync(fd);
  else FS.close(fd, done);
};

fs.open = function(path, flags, mode, done) {
  if ('function' === typeof mode) {
    done = mode;
    mode = null;
  }
  if (mode === undefined) mode = null;
  
  if (done === undefined) return FS.openSync(path, flags, mode);
  else FS.open(path, flags, mode, done);
};

fs.write = function(fd, data, position, encoding, done) {
  if (done === undefined) return FS.writeSync(fd, data, position, encoding);
  else FS.write(fd, data, position, encoding, done);
};

fs.read = function(fd, length, position, encoding, done) {
  if (done === undefined) return FS.readSync(fd, length, position, encoding);
  else FS.read(fd, length, position, encoding, done);
};

fs.readFile = function(path, encoding, done) {
  if ('function' === typeof encoding) {
    done = encoding;
    encoding = null;
  }
  if (!encoding) encoding = 'utf8';
  
  if (done === undefined) return FS.readFileSync(path, encoding);
  else FS.readFile(path, encoding, done);
};

fs.writeFile = function(path, data, encoding, done) {
  if ('function' === typeof encoding) {
    done = encoding;
    encoding = null;
  }
  if (!encoding) encoding = 'utf8';
  
  if (done === undefined) return FS.writeFileSync(path, data, encoding);
  else FS.writeFile(path, data, encoding, done);
};

fs.readJSON = function(path, done) {
  if (done === undefined) {
    var data = fs.readFile(path);
    var ret ;
    try {
      ret = JSON.parse(data);
    } catch(e) {
      core.debug('JSON read error in '+path);
      throw e;
    }
    return ret;
    
  } else {
    fs.readFile(path, function(err, data) {
      if (err) return done(err);
      
      try {
        data = JSON.parse(data);
      } catch(e) {
        err = e;
      }
      if (err) return done(err);
      return done(null, data);
    });
  }
};

fs.writeJSON = function(path, data, done) {

  var err;
  
  if (done === undefined) {
    data = JSON.stringify(data);
    return fs.writeFile(path, data);
    
  } else {
    try {
      data = JSON.stringify(data, null, ' '); // note ' ' pretty prints
    } catch(e) {
      err = e;
    }
    if (err) return done(err);
    fs.writeFile(path, data, done);
  }
};


fs.watchFile = FS.watchFile;
fs.unwatchFile = FS.unwatchFile;
fs.Stats = FS.Stats;
fs.FileReadStream = FS.FileReadStream;
fs.FileWriteStream = FS.FileWriteStream;
fs.createReadStream = FS.createReadStream;
fs.createWriteStream = FS.createWriteStream;


