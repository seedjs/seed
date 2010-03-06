// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co'),
    server = require('server'),
    Record = require('models/record'),
    Token; // fill in later to avoid cycles
    
var User = Record.extend({

  kind: 'users',
  
  tokenIds: function() {
    return this.data.tokens || [];
  },
  
  group: function() {
    return (this.data || this.data.group) ? this.data.group : 'guest';
  },
  
  tokens: function(done) {
    Co.map(this.tokenIds(), function(tokenId, done) {
      Token.find(tokenId, done);
    })(done); 
  },
  
  // tokens are dependent properties of users.  
  destroy: function(done) {
    var user = this;
    this.tokens(function(err, tokens) {
      if (err) return done(err);

      // destroy all tokens...
      if (!tokens) tokens = [];
      Co.parallel(tokens, function(token, done) {
        token.destroy(done);
        
      // then destroy this user
      })(function(err) {
        if (err) return done(err);
        Record.prototype.destroy.call(user, done);
      });
    });
  },
  
  prepare: function(data, done) {
    var r = {};
    r.id = this.id;
    r.email = data.email;
    r.name  = data.name;
    r.password = data.password;
    r.group = 'member';

    if (!r.email || !r.id) return done(401);
    this.data = r;
    this.isOpen = true;

    Co.sys.debug('prepared user: ' + this.id);
    
    // we need a new token for this user
    var tokenData = { user: this.id, creator: this.id, expires: 0 };
    
    Token.create(server.uuid(), tokenData, function(err, token) {
      if (err) return done(err);
      token.write(function(err) {
        Co.sys.debug('wrote token: ' + token.id);
        if (err) return done(err);
        r.tokens = [token.id];
        return done();   
      });
    });
    
  },
  
  // ..........................................................
  // PERMISSIONS
  // 

  canSeeAllTokens: function() {
    return this.group() === 'admin';
  },
  
  canSeeTokensForUser: function(user) {
    return (this.id !== 'anonymous') && 
           ((user.id===this.id) || (this.group() === 'admin'));
  },
  
  canGetUserIndex: function() {
    return (this.id !== 'anonymous') && (this.group() !== 'guest');
  },
  
  canShowUser: function(user) {
    return (this.id !== 'anonymous') && (this.group() !== 'guest');
  },
  
  canEditUser: function(user) {
    return (this.group() === 'admin') || (user.id === this.id);
  },
  
  // anyone can create a user - this is how you signup.  we might want to
  // change this eventually for private seed servers though
  canCreateUser: function(newUser) {
    return true;
  },
  
  // a user or admin can destroy himself
  canDestroyUser: function(user) {
    return (this.group() === 'admin') || (user.id === this.id);
  },
  
  // ..........................................................
  // Filtered Data
  // 
  
  indexJson: function(currentUser) {
    if (!this.isOpen) throw "record must be open before getting index";
    var ret = Co.mixin({}, this.data);
    ret['link-self'] = this.url();
    if (!currentUser || !currentUser.canSeeTokensForUser(this)) {
      delete ret.tokens;
    }
    return ret;
  },
  
  showJson: function(currentUser) {
    return this.indexJson(currentUser);
  }
  
});

User._find = Record.find;
User.find = function(id, done) {
  if (id === 'anonymous') return done(null, User.anonymous);
  else return User._find(id, done);
};

// Special anonymous record does not exist on disk
User.anonymous = new User('anonymous');
User.anonymous.open = function(done) { 
  return done(null, this); 
};

User.anonymous.write = function(done) { 
  return done('cannot modify anonymous');
};

User.anonymous.data = { 
  "id": "anonymous", 
  "group": "guest", 
  "name": "anonymous"
};

exports = module.exports = User;


Token = require('models/token');