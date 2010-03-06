// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co');
var router = require('node-router');
var server = require('server');
var tokens = require('resources/tokens');
var acls  = exports;

/**
  @file
  
  Acls provide access control to resources in a seed server.  You can 
  retrieve and edit an acl if you are the owner of the resource or if you
  belong to the admin ACL.
*/

// ..........................................................
// SUPPORT
// 

acls.find = function(aclId, done) {
  var path = Co.path.join.apply(Co.path, ['acls'].concat(aclId.split('/')));
  server.readJson(path, done);
};

acls.write = function(aclId, body, done) {
  var path = Co.path.join.apply(Co.path, ['acls'].concat(aclId.split('/')));
  server.writeJson(path, body, done);
};

acls.remove = function(aclId, done) {
  var path = Co.path.join.apply(Co.path, ['acls'].concat(aclId.split('/')));
  Co.path.exists(path, function(err, exists) {
    if (err) return done(err);
    if (exists) Co.fs.rm_r(path, function(err) { return done(err); });
    else return done(); // nothing to do
  });
};

/**
  Returns a filtered array of relationships that match the passed aclId.  
*/
acls.filter = function(resourceId, relationships, done) {
  
};
