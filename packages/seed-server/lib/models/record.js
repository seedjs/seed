// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co     = require('seed:co');
var server = require('server');

/**
  Describes a single JSON model on disk
*/
var Record = Co.extend({

  kind: 'records',
  
  isOpen: false,
  
  init: function(id) {
    this.id   = id;
    this.path = this.pathForId(id);
    this.open = Co.once(this.open);
  },
  
  url: function() {
    return '/seeds/'+this.kind+'/'+this.id;
  },
  
  indexPath: function() {
    return Co.path.join(server.root, this.kind);
  },
  
  pathForId: function(id) {
    return Co.path.join(this.indexPath(), id+'.json');
  },
  
  idForPath: function(path) {
    return Co.path.filename(path).slice(0,-5);
  },

  // called when a new record is created.  populates with data.  return 
  // and error to done if data is invalid
  prepare: function(data, done) { 
    this.data = Co.mixin({}, data); 
    this.data.id = this.id;
    this.isOpen = true;
    return done();
  },
  
  // reads the JSON from disk and invokes callback once read
  open: function(done) {
    var rec = this;
    if (this.isOpen) return done(null, this);
    server.readJson(rec.path, function(err, data) {
      if (err) return done(err);
      rec.data = data;
      rec.isOpen = true;
      return done(null, rec);
    });
  },
  
  // writes the JSON back to disk and invokes callback once complete
  write: function(done) {
    var rec = this;
    this.open(function(err) {
      if (err) return done(err);
      server.writeJson(rec.path, rec.data, function(err) {
        if (err) return done(err);
        else return done(null, rec);
      });
    });
  },
  
  // destroys the record if it exists on disk
  destroy: function(done) {
    var path = this.path;
    Co.path.exists(path, function(err, exists) {
      if (err) return done(err);
      if (exists) Co.fs.rm_r(path, function(err) { return done(err, this); });
      else return done(null, this);
    });
  },
  
  // ..........................................................
  // STANDARD FORMATTING
  // 
  
  indexJson: function(currentUser) {
    if (!this.isOpen) throw "record must be open before getting index";
    var ret = Co.mixin({}, this.data);
    ret['link-self'] = this.url();
    return ret;
  },
  
  showJson: function(currentUser) {
    return this.indexJson(currentUser);
  }
  
  
}); 

/**
  Finds an individual record.  Copy to subclasses
*/
Record.find = function(id, done) {
  var RecordType = this;
  var path = RecordType.prototype.pathForId(id);
  Co.path.exists(path, function(err, exists) {
    if (err) return done(err);
    if (exists) return (new RecordType(id)).open(done);
    else return done(null, null);
  });
};

/**
  Finds all records in the database
*/
Record.findAll = function(done) {
  var RecordType =this;
  var path = RecordType.prototype.indexPath();
  Co.fs.readdir_p(path, function(err, ids) {
    if (err) return done(err);
    if (!ids) ids = [];
    Co.collect(ids, function(id, done) { 
      id = id.slice(0,-5); // strip .json
      RecordType.find(id, done); 
    })(done);
  });
};

Record.create = function(id, data, done) {
  var RecordType = this;
  var path = RecordType.prototype.pathForId(id);
  Co.path.exists(path, function(err, exists) {
    if (err) return done(err);
    if (exists) return done(409); // Conflict
    else return RecordType.replace(id, data, done);
  });
};

Record.replace = function(id, data, done) {
  var RecordType = this;
  var ret = new RecordType(id);
  ret.prepare(data, function(err) { 
    Co.sys.debug('prepared ' + ret.id);
    return done(err, ret); 
  });
};

Record.extend = function(ext) {
  var Rec = Co.extend(this, ext);
  Rec.find = this.find;
  Rec.findAll = this.findAll;
  Rec.create = this.create;
  Rec.replace = this.replace;
  Rec.extend  = this.extend;
  return Rec;
};

exports = module.exports = Record;