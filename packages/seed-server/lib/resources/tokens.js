// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co'),
    url    = require('url'),
    router = require('node-router'),
    server = require('server'),
    users  = require('resources/users'),
    tokens = exports;

// ..........................................................
// SERVER ACTIONS
// 

// you can only list all tokens if the token you pass is for an admin user
tokens.index = function(req, res) {
  tokens.validate(req, function(err, user) {
    if (!user) return res.simpleText(403, 'Valid Token Required');
    
    // get all tokens I have access to.  basically tokens assigned to or 
    // created by me or all tokens if I am admin
    var path = Co.path.join(server.root, 'tokens');
    Co.fs.readdir_p(path, function(err, tokenIds) {
      if (err) return server.error(res, err);
      if (!tokenIds) tokenIds = [];
      
      // map to token info and then filter out
      Co.reduce(tokenIds, [], function(ret, tokenId, done) {
        tokenId = tokenId.slice(0,-5); // cut off .json
        tokens.find(tokenId, function(err, token) {
          if (err) return done(err);
          if (!token) return done(null, ret); // skip
          if ((user.group === 'admin') || (token.user === user.id) || (token.creator === user.id)) {
            ret.push(token);
          }
          return done(null, ret);
        });

      // send results
      })(function(err, ret) {
        if (err) return server.error(res, err);
        res.simpleJson(200, ret);
      });
    });
  });
};

// an admin user can create a token for anyone.  everyone else can create 
// tokens for themselves
tokens.create = function(req, res, body) {
  if (!body) return res.simpleText(400, 'Bad input');
  
  tokens.validate(req, function(err, user) {
    if (!user) return res.simpleText(403, 'Valid Token Required');
    if ((user.group!=='admin') && (user.id !== body.user)) {
      return res.simpleText(403, 'Forbidden');
    }
    
    // validate input
    if (!body.user) return res.simpleText(400, "User Required");
    if (body.expires) {
      body.expires = Number(body.expires);
      if (isNaN(body.expires)) {
        return res.simpleText(400, 'Malformed expires');
      }
    }
    
    // also the named user must exist
    users.find(body.user, function(err, found) {
      Co.sys.debug('found user: ' + Co.sys.inspect(found));
      
      if (err) return server.error(res, err);
      if (!found) return res.simpleText(400, 'User ID does not exist');
      
      // ok everything looks good, let's issue a token
      var tokenId = server.uuid();

      var info = {
        id: tokenId,
        user: found.id,
        creator: user.id,
        expires: body.expires || 0
      };
      tokens.write(tokenId, info, function(err) { 
        if (err) return server.error(res, err);
        
        if (!found.tokens) found.tokens = [];
        found.tokens.push(tokenId);
        users.write(found.id, found, function(err) {
          if (err) {
            tokens.remove(tokenId, true, Co.noop);
            return server.error(res, err);
          }

          return res.simpleText(201, 'Created', [
            ['Location', '/seed/tokens/'+tokenId],
            ['X-Seed-Token', tokenId]
          ]);
        });
        
      });
    });
  });
};

// if you know the id of a token, we will return the info for the token since
// knowing the token implicitly gives you permission to see it
tokens.show = function(req, res, id) {
  tokens.find(id, function(err, info) {
    if (err) return server.error(res, err);
    if (!info) return res.notFound(id + ' not found');
    res.simpleJson(200, info);
  });
};

// likewise, if you know a token id you can delete it since knowing gives you
// power to delete
tokens.destroy = function(req, res, tokenId) {
  var path = Co.path.join(server.root, 'tokens', tokenId+'.json');
  tokens.remove(tokenId, false, function(err) {
    res.simpleText(200, 'Deleted');
  });
};


// ..........................................................
// UTILITY METHODS
// 

/**
  Writes a token back to disk
*/
tokens.write = function(tokenId, info, done) {
  tokenId = tokenId.toLowerCase();
  var path = Co.path.join(server.root, 'tokens', tokenId+'.json');
  server.writeJson(path, info, done);
};

/**
  Finds a token JSON on disk and returns it.  Invokes will null if not found
*/
tokens.find = function(tokenId, done) {
  tokenId = tokenId.toLowerCase();
  var path = Co.path.join(server.root, 'tokens', tokenId+'.json');
  server.readJson(path, done);
};

tokens.remove = function(tokenId, tokenOnly, done) {
  
  tokenId = tokenId.toLowerCase();

  // if not tokenOnly, also lookup user and remove other direction
  (function(done) {
    if (!tokenOnly) {
      tokens.find(tokenId, function(err, token) {
        if (err) return done(err);
        if (token) {
          users.find(token.user, function(err, user) {
            if (err || !user || !user.tokens) return done(); // just skip
            var idx = user.tokens.indexOf(tokenId);
            if (idx<0) return done(); 
            
            user.tokens = user.tokens.slice(0,idx).concat(user.tokens.slice(idx+1));
            users.write(user.id, user, done);
          });
        } else done();
      });
    } else done();
    
  })(function(err) {
    if (err) return done(err);
    
    var path = Co.path.join(server.root, 'tokens', tokenId+'.json');
    Co.path.exists(path, function(err, exists) {
      if (err) return done(err);
      (function(done) {
        if (exists) Co.fs.rm_r(path, done);
        else done();
      })(function(err) { return done(err); });
    });
    
  });
};

/**
  Lookup the user for the named token and returns the user information.  If
  no matching token could be found, returns null.
*/
tokens.user = function(tokenId, done) {
  tokenId = tokenId.toLowerCase();
  tokens.find(tokenId, function(err, info) {
    if (err || !info) return done(err);
    users.find(info.user, done);
  });
};

/**
  Extracts the tokenId from the request query parameters then discovers the
  user.
*/
tokens.validate = function(req, done) {
  var tokenId = url.parse(req.url, true).query;
  if (tokenId) tokenId = tokenId.token;
  if (tokenId) {
    tokenId = tokenId.toLowerCase();
    tokens.user(tokenId, function(err, info) {
      if (err) return done(err);
      if (!info) return users.find('anonymous', done);
      else return done(null, info);
    });
    
  } else return users.find('anonymous', done);
};

