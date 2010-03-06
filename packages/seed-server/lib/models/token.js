// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co'),
    server = require('server'),
    Record = require('models/record'),
    User;


var Token = Record.extend({
  kind: 'tokens',
  
  userId: function() {
     return this.data ? this.data.user : null;
  },
  
  user: function(done) {
    this.open(function(err) {
      if (err) return done(err);
      return User.find(this.data.user, done);
    });
  }
  
});


exports = module.exports = Token;
User = require('models/user');