// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co'),
    server = require('server'),
    Record = require('models/record'),
    Acl    = require('models/acl');


var PackageInfo = Record.extend({
  kind: 'packages',
  
  assetId: function() {
    return this.data['.seed-asset'];
  },
  
  assetPath: function() {
    return Co.path.join(server.root, 'assets', this.assetId());    
  }
    
});

// takes an existing Package in memory and installs the package info into 
// the database.
PackageInfo.install = function(pkg, assetFilename, currentUser, done) {
  var info = Co.mixin({}, pkg.info()); // copy and fixup
  
  // add local properties we care about
  info['.seed-asset'] = assetFilename;

  var id = Co.path.join(pkg.name(),pkg.version());
  PackageInfo.create(id, info, done);
  
  // see if a matching Acl exists already for the package id.  If it doesn't,
  // create one with the currentUser as owner.
};

exports = module.exports = PackageInfo;
