// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:private/co'),
    server = require('server'),
    Record = require('models/record');

/** 
  Access Control List - manages access to resources, primarily packages.
  
  An Acl must always have:
  
  * `id`: designates the resource the Acl corresponds to.  Usually type/id.
  * `owners`: one or more owner users that can modify the Acl (as can admins)
  * `readers`: zero or more users that can retrieve the resource in question
  * `writers`: zero or more users that can modify the resource in question
  
  You should only retrieve an Acl itself if you are admin or owner.
*/
var Acl = Record.extend({
  
  kind: 'acls',
  
  usersForOperation: function(op) {
    return this._idsForOperation(op, 'users');
  },
  
  groupsForOperation: function(op) {
    return this._idsForOperation(op, 'groups');
  },

  _idsForOperation: function(op, namespace) {
    if (!this.isOpen) throw "Acl must be open";
    var ret = [], ids = this.data[op] || [];
    namespace = namespace+'/';
    ids.forEach(function(key) {
      if (key.indexOf(namespace)===0) {
        ret.push(key.slice(namespace.length));
      }
    });
    return ret ;
  },
  
  operationsForUser: function(userId, groupId) {
    if (!this.isOpen) throw "Acl must be open";
    var ret = [], data = this.data;
    
    if (userId) userId = 'users/'+userId;
    if (groupId) groupId = 'groups/'+groupId;
    
    Acl.OPS.forEach(function(key) {
      var op = data[key];
      if (op) {
        if (userId && (op.indexOf(userId)>=0)) ret.push(key);
        if (groupId && (op.indexOf(groupId)>=0)) ret.push(key);
      }
    });
    
    return ret ;
  },
  
  prepare: function(data, done) {
    var r = {};
    r.id = this.id;
    Acl.OPS.forEach(function(key) {
      var val = data[key];
      if ('string' === typeof val) val = [val];
      if (!val) val = [];
      r[key] = val;
    }, this);
    
    this.data = r;
    this.isOpen = true;
    return done();
  },
  
  update: function(data, done) {
    if (!this.isOpen) throw "Acl must be open";
    
    var r = Co.mixin({}, this.data);

    Acl.OPS.forEach(function(key) {
      if (data.hasOwnProperty(key)) {
        var val = data[key];
        if ('string' === typeof val) val = [val];
        if (!val) val = [];
        r[key] = val;
      }
    }, this);
    
    this.data = r;
    return this.write(done);
  }
  
});

Acl.OWNER_OP = 'owners';
Acl.READ_OP = 'readers';
Acl.WRITE_OP = 'writers';
Acl.OPS = [Acl.OWNER_OP, Acl.READ_OP, Acl.WRITE_OP];


// find acl for the resource ID, verify that the user can perform the named
// operation.  must be Acl.READ_OP or Acl.WRITE_OP.
Acl.validate = function(resourceId, user, operation, done) {
  Acl.find(resourceId, function(err, acl) {
    if (err) return done(err);
    if (!acl) return done(null, false);
    
    var userIds = acl.usersForOperation(operation);
    return done(null, userIds.indexOf(user.id)>=0);
  });
};

exports = module.exports = Acl;
