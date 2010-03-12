// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:private/co'),
    server = require('server'),
    Token  = require('models/token'),
    Acl    = require('models/acl');

/**
  @file
  
  Acls provide access control to resources in a seed server.  You can 
  retrieve and edit an acl if you are the owner of the resource or if you
  belong to the admin ACL.
*/

// you can only retrieve acls if you are admin
exports.index = function(req, res) {
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
    if (!currentUser.canSeeAcls()) return server.forbidden(res);
    Acl.findAll(function(err, acls) {
      if (err || !acls) return server.error(acls, err || 401);
      acls = acls.map(function(acl) { return acl.indexJson(); });
      return res.simpleJson(200, { records: acls });
    });
  });
};

// you can view a token only if you are admin, reader, writer, owner
exports.show = function(req, res, id) {
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
    Acl.find(id, function(err, acl) {
      if (err || !acl) return server.error(res, err || 404);
      if (!currentUser.canShowAcl(acl)) return server.forbidden(res);
      return res.simpleJson(200, acl.showJson());
    });
  });
};

// you can edit an Acl if you own it or you are a user
exports.update = function(req, res, id, data) {
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
    Acl.find(id, function(err, acl) {
      if (err || !acl) return server.error(res, err || 404);
      if (!currentUser.canEditAcl(acl)) return server.forbidden(res);
      acl.update(data, function(err) {
        if (err) return server.error(res, err);
        else return res.simpleText(200, '');
      });
    });
  });
};

// you can't create an Acl right now. Acls are created automatically when you
// upload a new package
exports.create = function(req, res, data) {
  return server.forbidden(res);
};

// you can't delete an Acl right now.  Acls are deleted automatically when 
// you delete the corresponding package
exports.destroy = function(req, res, id) {
  return server.forbidden(res);
};

