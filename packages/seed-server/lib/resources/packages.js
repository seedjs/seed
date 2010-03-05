// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co');
var router = require('node-router');
var server = require('server');
var tokens = require('resources/tokens');
var url    = require('url');
var semver = require('seed:semver');
var packages  = exports;

// ..........................................................
// RESOURCE API
// 

packages.show = function(req, res, id) {
  var opts = url.parse(req.url, true).query,
      vers = opts ? opts.version : null;
      
  Co.chain(function(done) {
    if (vers) return done(null, vers) ;
    
    var path = Co.path.join(server.root, 'packages', id);
    Co.fs.readdir_p(path, function(err, versions) {
      Co.sys.puts(Co.sys.inspect(versions));
      if (!versions || (versions.length===0)) return res.notFound();
      versions.forEach(function(curVers) {
        curVers = curVers.slice(0, -5); // cut off .json
        if (!vers || (semver.compare(vers, curVers)<0)) vers = curVers;
      });
      return done(null, vers); // picked latest
    });
  },
  
  function(vers, done) {
    var path = Co.path.join(server.root, 'packages', id, vers+'.json');
    server.readJson(path, function(err, info) {
      if (err) return done(err);
      
      if (!info) res.notFound();
      else res.simpleJson(200, info);
      return done(); // ok!
    });
  })(function(err) {
    if (err) return server.error(err);
  });
  
};

// ..........................................................
// HELPERS
// 

packages.install = function(pkg, assetFilename, done) {
  var info = Co.mixin({}, pkg.info()); // copy and fixup
  info['link-asset'] = '/seed/assets/'+assetFilename;
  info['link-self'] = '/seed/packages/'+pkg.name()+'?version='+pkg.version();

  var infoPath = Co.path.join(server.root, 'packages', pkg.name(), pkg.version() + '.json');
  server.writeJson(infoPath, info, done);
};