// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co');
var router = require('node-router');
var server = require('server');
var Token  = require('models/token');
var Package = require('seed:package');
var packages = require('resources/packages');
var assets = exports;

// ..........................................................
// RESOURCE API
// 

/**
  Accept an upload - you must be a valid user and not a guest to do this
*/
exports.create = function(req, res, body) {
  tokens.validate(req, function(err, user) {
    if (err) return server.error(res, err);
    if (!user || (user.id === 'anonymous')) {
      return res.simpleText(403, 'Invalid token');
    }

    // pick a filename to make sure its unique
    var path = Co.path.join(server.root, 'tmp', server.uuid()+'.zip');
    Co.fs.mkdir_p(Co.path.dirname(path), 511, function(err) {
      if (err) return server.error(res, err);
      Co.fs.open(path, 'w+', 511, function(err, fd) {
        if (err) return server.error(res, err);
        
        // now we can just read streams of data and write them in
        req.setBodyEncoding('binary');

        // note we have to use this endWrite() method to make sure all file
        // writes complete before we continue processing.  Otherwise you will
        // sometimes get corrupt data
        var level = 1;
        function endWrite() {
          Co.sys.debug('endWrite(level='+level+')');
          
          if (--level <= 0) {
            assets.process(path, function(err) {
              if (err) server.error(res, err);
              else res.simpleText(200, 'OK');
            });
          }
        }
        
        req.addListener('data', function(chunk) {
          level++;
          Co.fs.write(fd, chunk, null, 'binary', function(err) {
            if (err) return server.error(res, err);
            endWrite();
          });
        });
        
        req.addListener('end', endWrite);
        
        req.resume();
      });
    });
  });
};

/**
  Retrieves an individual asset.  Make sure the requesting user is included
  in the ACL for the asset or is an admin
*/
exports.show = function(req, res, filename) {
  var path = Co.path.join(server.root, 'assets', filename);
  Co.sys.debug(path);
  Co.path.exists(path, function(err, exists) {
    if (err) return server.error(res, err);
    if (!exists) return res.notFound('Filename does not exist');
    
    // file found, just stream it back
    var contentType = router.mime.lookupExtension(Co.path.extname(path));
    Co.fs.stat(path, function(err, stats) {
      if (err) return server.error(res, err);

      var len = stats.size, pos = 0;
      
      Co.fs.open(path, 'r', 0, function(err, fd) {
        if (err) return server.error(res, err);
        
        Co.sys.debug(Co.sys.inspect([
          ['Content-Type', contentType],
          ['Content-Length', len],
          ['Cache-Control', 'public']]));

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
            Co.sys.debug('read bytes: ' + byteCnt);
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
  });
};


// ..........................................................
// SUPPORT
// 

assets.process = function(path, done) {
  
  // first unzip package so we can inspect it
  Co.chain(function(done) {
    var unzipdir = path.slice(0, 0-Co.path.extname(path).length);
    var cmd = 'unzip ' + path + ' -d ' + unzipdir;
    Co.sys.debug('processing: ' + path + ' dir: ' + unzipdir);
    Co.sys.exec(cmd, function(err) { 
      Co.sys.debug('unzipped');
      return done(err, unzipdir); });
  },
  
  // next figure out the package path to look at.  It is the first 
  // path in the directory
  function(unzipdir, done) {
    Co.fs.readdir_p(unzipdir, function(err, dirnames) {
      if (!err && (!dirnames || !dirnames.length===0)) {
        err = "Zipped package is empty";
      }
      if (err) return done(err);
      else return done(null, Co.path.join(unzipdir, dirnames[0]));
    });
    
  },
  
  // now, open the package and verify the info.  Copy it over if needed
  function(packagedir, done) {
    Co.sys.debug('examining '+packagedir);
    Package.open(packagedir, function(err, pkg) {
      if (err) return done(err);
      
      var name = pkg.name();
      var version = pkg.version();
      var assetFilename = name+'-'+version+'.zip';
      var assetPath = Co.path.join(server.root, 'assets', assetFilename);
      Co.path.exists(assetPath, function(err, exists) {
        if (err) return done(err);
        if (exists) return done('Asset exists');
        Co.fs.mv(path, assetPath, function(err) {
          if (err) return done(err);
          else return done(null, pkg, assetFilename);
        });
      });
      
    });
  },
  
  function(pkg, assetFilename, done) {
    Co.sys.debug('moved to '  +assetFilename);
    packages.install(pkg, assetFilename, done);
    
  })(done);
  
};
