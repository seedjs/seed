// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co');
var router = require('node-router');
var server = require('server');
var tokens = require('resources/tokens');
var users  = exports;

// ..........................................................
// SERVER ACTIONS
// 

// index action - returns all users in system
// you must be a user to get this information - not anonymous or guest
users.index = function(req, res) {
  tokens.validate(req, function(err, user) {
    if (err) return server.error(res, err);
    if (user.group === 'guest') return res.simpleText(403, 'Forbidden');
    
    var path = Co.path.join(server.root, 'users');
    Co.fs.readdir_p(path, function(err, userIds) {
      if (err) return server.error(res, err);

      // normalize - always have array and cut of '.json' since db() adds it
      if (!userIds) userIds = [];
      userIds = userIds.map(function(userId) { return userId.slice(0,-5); });
      Co.map(userIds, users.find)(function(err, userRecords) {

        // add in link to self
        userRecords.forEach(function(cur) {
          cur['link-self'] = '/seed/users/'+cur.id;
          if (user.group !== 'admin') delete cur.tokens;
        });

        if (err) return server.error(res, err);
        return res.simpleJson(200, userRecords);
      });
    });
    
  });
};

// you must be a current user to retrieve information about another user
users.show = function(req, res, id) {
  tokens.validate(req, function(err, user) {
    if (err) return server.error(res, err);
    users.find(id, function(err, found) {
      if (err) return server.error(res, err);
      if (!found) return res.simpleText(404, 'Not Found');
      if (user.group !== 'admin') delete found.tokens; // filter
      res.simpleJson(200, found);
    });
  });
};

// anyone can create a new user.  This is how you signup.  We will also give
// you a default token.  Returns 409 Conflict if username already exists
users.create = function(req, res, body) {
  if (!body) return res.simpleText(401, 'Malformed body');
  if (!body.id || !body.email) {
    return res.simpleText(401, 'Requires user id and email');
  }
  
  tokens.validate(req, function(err, currentUser) {
    users.find(body.id, function(err, found) {
      if (found) return res.simpleText(409, 'Conflict - User ID exists');

      var user = { id: body.id, email: body.email };
      user.name = body.name || body.id;
      user.group = (user.group && currentUser && (currentUser.group==='admin')) ? user.group : 'member';

      var tokenId = server.uuid();
      var token = {
        id: tokenId, 
        user: user.id,
        creator: user.id,
        expires: 0
      };
      user.tokens = [tokenId];
      
      tokens.write(tokenId, token, function(err) {
        if (err) return server.error(res, err);
        users.write(user.id, user, function(err) {
          if (err) return server.error(res, err);
          return res.simpleJson(201, user, [
            ['Location', '/seeds/users/'+user.id],
            ['X-Seed-Token', tokenId]
          ]);
        });
      });
      
    });
  });
};

// must be user or admin
users.destroy = function(req, res, id) {
  tokens.validate(req, function(err, currentUser) {
    if (err) return server.error(res, err);
    if ((currentUser.id === 'anonymous') ||
        ((currentUser.id !== id) && (currentUser.group !== 'admin'))) {
          return res.simpleText(403, '');
    }
    
    users.remove(id, false, function(err) {
      if (err) return server.error(res, err);
      return res.simpleText(200, 'Destroyed');
    });
    
  });
};

// ..........................................................
// UTILITIES
// 

/**
  Finds a user's information on disk.  If not found, returns null.
*/
users.find = function(userId, done) {
  
  // anonymous user always exists even if its fake
  if (userId === 'anonymous') {
    return done(null, {
        "id": "anonymous",
        "group": "guest",
        "name": "Anonymous"
    });
    
  } else {
    var path = Co.path.join(server.root, 'users', userId+'.json');
    server.readJson(path, done);
  }
};

/**
  Writes user info back to disk
*/
users.write = function(userId, info, done) {
  var path = Co.path.join(server.root, 'users', userId+'.json');
  server.writeJson(path, info, done);
};

/**
  Removes the user info
*/
users.remove = function(userId, userOnly, done) {
  var path = Co.path.join(server.root, 'users', userId + '.json');
  
  // if not userOnly, remove tokens as well
  (function(done) {
    if (userOnly) return done();
    users.find(userId, function(err, user) {
      if (err) return done(err);
      if (!user || !user.tokens) return done(); // nothing to do
      Co.parallel(user.tokens, function(tokenId, done) {
        tokens.remove(tokenId, true, done);
      })(done);
    });

  // next remove  the user.json
  })(function(err) {
    Co.path.exists(path, function(err, exists) {
      if (err) return done(err);
      if (exists) Co.fs.rm_r(path, function(err) { return done(err); });
      else return done(); // nothing to do
    });
  });
};



