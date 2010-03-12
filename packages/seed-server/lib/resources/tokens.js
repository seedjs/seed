// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:private/co'),
    router = require('node-router'),
    server = require('server'),
    users  = require('resources/users'),
    tokens = exports;
    
var Token = require('models/token');
    
var User = require('models/user');

// ..........................................................
// SERVER ACTIONS
// 

// you can only list all tokens if the token you pass is for an admin user
exports.index = function(req, res) {
  Token.validate(req, function(err, currentUser) {
    if (currentUser.canSeeAllTokens()) {
      Token.findAll(function(err, tokens) {
        if (err) return server.error(res, err);
        tokens = tokens.map(function(token) {
          return token.indexJson(currentUser);
        });
        return res.simpleJson(200, tokens);
      });
      
    } else if (currentUser.canSeeTokensForUser(currentUser)) {
      Token.findAll(function(err, tokens) {
        if (err) return server.error(res, err);
        tokens = tokens.filter(function(token) {
          return token.userId() === currentUser.id;
        });

        tokens = tokens.map(function(token) {
          return token.indexJson(currentUser);
        });
        return res.simpleJson(200, { "records": tokens });
      });
      
    } else return server.forbidden(res);
  });
};

// an admin user can create a token for anyone.  everyone else can create 
// tokens for themselves
exports.create = function(req, res, body) {
  Co.sys.puts(body);
  if (!body) return server.error(res, 400);
  
  Token.validate(req, function(err, currentUser) {
    
    // lookup the user first
    var userId = body ? body.user : null;
    (function(done) {
      if (!userId) return done(); // no user
      User.find(userId, done);
      
    // if a user if found, make sure the caller has authority to create a
    // token for it
    })(function(err, user) {
      if (err || !user) return server.error(res, err || 400);
      if (!currentUser.canCreateTokenForUser(user)) {
        return server.forbidden(res);
      }

      // create the token - write both token and update user
      Token.create(server.uuid(), body, function(err, token) {
        if (err || !token) return server.error(res, err || 400);
        token.write(function(err) {
          if (err) return server.error(res, err);
          user.tokenIds().push(token.id);
          user.write(function(err) {
            if (err) return server.error(res, err);
            return res.simpleJson(201, token.showJson(currentUser), [['Location', token.url()]]);
            
          });
        });
      });
    });
  });
};

// if you know the id of a token, we will return the info for the token since
// knowing the token implicitly gives you permission to see it
exports.show = function(req, res, id) {
  Token.find(id, function(err, token) {
    if (err) return server.error(res, err);
    if (!token) return res.notFound();
    res.simpleJson(200, token.showJson());
  });
};

// likewise, if you know a token id you can delete it since knowing gives you
// power to delete
exports.destroy = function(req, res, id) {
  Token.find(id, function(err, token) {
    if (err) return server.error(res, err);
    (function(done) {
      if (token) token.destroy(done);
      else done();
    })(function(err) {
      if (err) return server.error(res, err);
      return res.simpleText(200, 'OK');
    });
  });
};


