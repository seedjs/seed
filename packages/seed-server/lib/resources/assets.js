// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:private/co'),
    server = require('server'),
    Token  = require('models/token'),
    PackageInfo = require('models/package_info'),
    Package = require('seed:package');

// ..........................................................
// RESOURCE API
// 

/**
  Accept an upload - you must be a valid user and not a guest to do this
*/
exports.create = function(req, res, body) {

  // note - receive file right away.  Otherwise some data may drop on the 
  // floor
  var path = Co.path.join(server.root, 'tmp', server.uuid()+'.zip');
  server.receiveFile(req, path, function(err) {
    if (err) return server.error(res, err);
    Token.validate(req, function(err, currentUser) {
      if (err || !currentUser) {
        Co.sys.debug(err || 'no valid user');
        return server.error(res, err || 403, 'No valid user');
      }

      exports.process(path, currentUser, function(err) {
        if (err) server.error(res, err);
        else res.simpleText(200, 'OK');
      });
    });
  });  
};

/**
  Retrieves an individual asset.  Make sure the requesting user is included
  in the ACL for the asset or is an admin
*/
exports.show = function(req, res, packageId) {
  if (packageId.match(/\.zip$/)) packageId = packageId.slice(0,-4);
  
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403, 'No valid user');
    
    PackageInfo.find(packageId, function(err, packageInfo) {
      if (err || !packageInfo) return server.error(res, err || 404, 'Package not found');
      packageInfo.acl(function(err, acl) {
        if (err || !acl) return server.error(res, err || 503, 'Invalid acl');
        if (!currentUser.canShowPackageInfo(packageInfo, acl)) {
          return server.forbidden(res);
        }

        var path = packageInfo.assetPath();
        Co.path.exists(path, function(err, exists) {
          if (err || !exists) {
            return server.error(res, err || 404, 'Asset not found');
          }
          return server.sendFile(res, path);
        });
        
      });
    });
  });

};


// ..........................................................
// SUPPORT
// 

exports.process = function(path, currentUser, done) {
  
  // first unzip package so we can inspect it
  Co.chain(function(done) {
    var unzipdir = path.slice(0, 0-Co.path.extname(path).length);
    var cmd = 'unzip ' + path + ' -d ' + unzipdir;
    Co.sys.exec(cmd, function(err) { 
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
    Package.open(packagedir, function(err, pkg) {
      if (err) return done(err);
      if (!pkg) return done({ status: 400, message: 'Package is not valid' });
      return done(null, pkg, packagedir);
    });
  },

  // finally attempt to install the package
  function(pkg, srcPath, done) {
    PackageInfo.install(pkg, path, currentUser, done);
  })(done);
  
};
