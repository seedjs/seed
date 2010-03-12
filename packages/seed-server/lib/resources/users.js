// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co'),
    server = require('server'),
    User   = require('models/user'),
    Token  = require('models/token');
    
// ..........................................................
// SERVER ACTIONS
// 

// index action - returns all users in system
// you must be a user to get this information - not anonymous or guest
exports.index = function(req, res) {
  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    if (!currentUser.canGetUserIndex()) return server.forbidden(res);
    
    // find all users and generate index JSON
    User.findAll(function(err, users) {
      if (err) server.error(res, err);
      users = users.map(function(user) { 
        return user.indexJson(currentUser); 
      });
      
      return res.simpleJson(200, { records: users });
    });
    
  });
};

// you must be a current user to retrieve information about another user
exports.show = function(req, res, id) {
  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    
    User.find(id, function(err, user) {
      if (err) return server.error(res, err);
      if (!user) return res.notFound();
      if (!currentUser.canShowUser(user)) return server.forbidden(res);
      return res.simpleJson(200, user.showJson(currentUser));
    });

  });
};

// only the owner or admin can update
exports.update = function(req, res, id, body) {
  if (!body) return server.error(res, 401);
  Token.validate(req, function(err, currentUser) {
    if (err || !currentUser) return server.error(res, err || 403);
    User.find(id, function(err, user) {
      if (err || !user) return server.err(res, err || 404, 'User not found');
      if (!currentUser.canEditUser(user)) return server.forbidden(res);
      user.update(body, function(err) {
        if (err) return server.error(res, err);
        return res.simpleText(200, '');
      });
    });
  });
};

// anyone can create a new user.  This is how you signup.  We will also give
// you a default token.  Returns 409 Conflict if username already exists
exports.create = function(req, res, body) {
  if (!body || !body.id) return server.error(res, 401);

  Token.validate(req, function(err, currentUser) {
    User.create(body.id, body, function(err, user) {
      if (err) return server.error(res, err);
      if (!currentUser.canCreateUser(user)) return server.forbidden(res);
      user.write(function(err) {
        if (err) return server.error(res, err);
        return res.simpleJson(201, user.showJson(user), [
          ['Location', user.url()],
          ['X-Seed-Token', user.tokenIds()[0]]
        ]);
        
      });
    });
  });
};

// must be user or admin
exports.destroy = function(req, res, id) {

  Token.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    User.find(id, function(err, user) {
      if (err) return server.error(res, err);
      if (!user) return res.simpleText(200,''); // idempotent
      if (!currentUser.canDestroyUser(user)) return server.forbidden(res);
      user.destroy(function(err) {
        if (err) return server.error(res, err);
        return res.simpleText(200, '');
      });
    });

  });
};

