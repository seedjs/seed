// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co = require('seed:co');
var router = require('node-router');
var cache  = require('cache');
var O_RWX = 511; //0777
var server = exports;

// default settings
exports.host = '0.0.0.0'; 
exports.port = '80';
exports.root = '~/.seeds/server';

// registers a new resource on the router - globbing any remaining components
exports.globResource = function (router, name, controller, format) {
  router.get(new RegExp('^/' + name + '$'), controller.index);
  router.get(new RegExp('^/' + name + '/(.+)$'), controller.show);
  router.post(new RegExp('^/' + name + '$'), controller.create, format);
  router.put(new RegExp('^/' + name + '/(.+)$'), controller.update, format);
  router.del(new RegExp('^/' + name + '/(.+)$'), controller.destroy);
};

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
  router.resource('seed/assets', require('resources/assets'), 'undefined');

  exports.globResource(router, 'seed/acls', require('resources/acls'), 'json');
  exports.globResource(router, 'seed/packages', require('resources/packages'), 'json');
  exports.globResource(router, 'seed/assets', require('resources/assets'), 'json');

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
exports.error = function(res, err, desc) {
  if ('number' === typeof err) res.simpleText(err, desc||'');
  else if (err.status && err.message) {
    res.simpleText(err.status, err.message);
  } else res.simpleText(503, err.toString());
};

/**
  Helper method used to return a forbidden url
*/
exports.forbidden = function(res, reason) {
  if (!reason) reason = '';
  res.simpleText(403, reason);
};


exports.uuid = Co.uuid;

/**
  Reads a JSON file from disk.
*/
exports.readJson = function(path, done) {
  cache.read(path, function(done) {
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
  }, done);
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

  function resetCache(err) {
    cache.remove(path, function(err2) {
      return done(err || err2);
    });
  }
  
  Co.path.exists(path, function(err, exists) {
    if (err) return resetCache(err);
    
    // if file already exists - delete it then write
    if (exists) {
      Co.fs.rm_r(path, function(err) {
        if (err) return resetCache(err);
        Co.fs.writeFile(path, content, function(err) { resetCache(err); });
      });
      
    // file does not exist - make containing dirs and then write
    } else {

      Co.fs.mkdir_p(Co.path.dirname(path), O_RWX, function(err) {
        if (err) return resetCache(err);
        Co.fs.writeFile(path, content, function(err) { resetCache(err); });
      });
    }
  });
  
};

// responds with a path...
exports.sendFile = function(res, path) {
  
  // file found, just stream it back
  var contentType = router.mime.lookupExtension(Co.path.extname(path));
  Co.fs.stat(path, function(err, stats) {
    if (err) return server.error(res, err);

    var len = stats.size, pos = 0;
    Co.fs.open(path, 'r', 0, function(err, fd) {
      if (err) return server.error(res, err);
      
      // ok we have a size + file is open so streaming should go OK...
      res.sendHeader(200, [
        ['Content-Type', contentType],
        ['Content-Length', len],
        ['Cache-Control', 'public']]);
        
      var readNext = function(done) {
        if (pos>=len) return done();
        Co.fs.read(fd, 4096, pos, 'binary', function(err, data, byteCnt) {
          if (err) return done(err); // failed!
          res.write(data, 'binary'); // write partial
          pos += byteCnt;
          readNext(done);
        });
      };
      
      readNext(function(err) {
        if (err) Co.sys.debug(err);
        Co.fs.close(fd);
        res.close();
      });
      
    });
  });
};

// receives a file, writing it to the named path.  calls done when ready
exports.receiveFile = function(req, path, done) {

  var queue = [];
  var writing = false;
  var level = 1;
  var cancelled = false;
  var fd = null;
  
  function endWrite() {
    if (--level <= 0) {
      return done(); // success
    }
  }
  
  function writeChunk() {
    if (writing || !fd) return ; // can't run yet
    var chunk = queue.shift();
    if (chunk !== undefined) {
      writing = true;
      Co.fs.write(fd, chunk, null, 'binary', function(err) {
        if (err) return server.error(res, err);
        writing = false;
        endWrite();
        writeChunk();
      });
    }
  }
  
  function cancel(err) {
    if (cancelled) return true;
    cancelled = true;
    return done(err);
  }
  
  // now we can just read streams of data and write them in
  req.setBodyEncoding('binary');
  
  // Add listener to receive data immediately...
  req.addListener('data', function(chunk) {
    if (cancelled) return ; // nothing to do
    level++;

    queue.push(chunk);
    writeChunk();
  });
  
  // finished - endWrite which will unlock flushing
  req.addListener('end', function(){
    if (cancelled) return;
    endWrite();
  });
  
  // also, setup fd
  Co.fs.mkdir_p(Co.path.dirname(path), 511, function(err) {
    if (err) cancel(err);
    
    Co.fs.open(path, 'w+', 511, function(err, newFd) {
      if (err) cancel(err);
      fd = newFd; // save fd and flush any pending data
      writeChunk();
    });
  });
};


