// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co'),
    server = require('server'),
    Record = require('models/record'),
    url    = require('url'),
    User;


var Token = Record.extend({
  kind: 'tokens',
  
  userId: function() {
     return this.data ? this.data.user : null;
  },
  
  user: function(done) {
    var tok = this;
    this.open(function(err) {
      if (err) return done(err);
      
      var userId = tok.userId();
      if (userId) return User.find(userId, done);
      else return done(null, null);
    });
  },
  
  prepare: function(data, done) {
    var r = {};
    r.id = this.id;
    r.user = data.user;
    r.expires = Number(data.expires);
    if (isNaN(r.expires)) r.expires = 0;
    this.data = r;
    this.isOpen = true;
    return done();
  }
  
});

/**
  Extracts the tokenId from the request query parameters then discovers the
  user.
*/
Token.validate = function(req, done) {
  var query = url.parse(req.url, true).query, tokenId, username, password;
  if (query) {
    tokenId = query.token;
    username = query.username;
    if (query.password) {
      password = require('seed:md5').b64(query.password);
    } else if (query.digest) {
      password = query.digest;
    }
  }

  // first attempt to lookup the user.  
  (function(done) {
    
    // username/password auth
    if (username) {
      User.find(username, function(err, user) {
        if (err) return done(err);
        if (!user || !(user.password()===password)) return done(); 
        else return done(null, user);
      });
    
    // token auth (preferred mode);
    } else if (tokenId) {
      tokenId = tokenId.toLowerCase();
      Token.find(tokenId, function(err, token) {
        if (err) return done(err);
        if (!token) return done();
        else return token.user(done);
      });
      
    // no auth...
    } else return done();
    
  // if no user is found, map to anonymous
  })(function(err, user) {
    if (err) return done(err);
    if (user) return done(null, user);
    else return User.find('anonymous', done);
  });
};

exports = module.exports = Token;
User = require('models/user');