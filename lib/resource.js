// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */

var Co = require('./private/co');

/**
  @class
  
  A Resource represents an asset on the disk that can be opened and closed,
  meaning it's content is loaded into memory and then possibly written back
  out. 

  This is the generic base class used by both Repositories and Packages to 
  work with assets on disk.  When subclassing you must implement the 
  primitive interface:

    readContent:
      should read any initial content from disk and then invoke the passed 
      done when finished.  Invoking the done will put the resource 
      into an open state.
      
    releaseContent:
      cleanup any in-memory content previously read from disk and then invoke
      the passed done.  Invoking the done will put the resource into
      a closed state.
      
    writeContent:
      write any modified content to disk and then invoke the done.  
      Invoking the done will put the resource back into an open state from
      a writing state
      
  The Resource.open(), close() and write() methods ensure that your primitive
  methods are only called one at a time even from multiple callers.

*/  
var Resource = Co.extend({

  init: function(path) {
    this.path = Co.path.normalize(path);
  },
  
  state: 'start',
  
  // ..........................................................
  // PRIMITIVES
  // 
  
  /**
    Returns true|false to callback if resource exists on disk.  Normally
    this will check for the path existance, but you might want to override
    with more specific checks as well.
    
    @param {Function} callback 
      Invoked with an optional error and boolean indicating whether resource
      exists or not
      
    @returns {void}
  */
  exists: function(callback) {
    Co.path.exists(this.path, callback);
  },
  
  /**
    Invoked once to setup a new resource that does not yet exist on disk
  */
  setupContent: function(done) {
    done();
  },
  
  /**
    Read content from disk for an existing resource
  */
  readContent: function(done) {
    done();
  },
  
  /**
    Release loaded content from memory
  */
  releaseContent: function(done) {
    done();
  },

  /**
    Write content to disk
  */
  writeContent: function(done) {
    done(null, true);
  },
  
  // ..........................................................
  // OPENING AND CLOSING
  // 
  
  /**
    Setup the resource as a new resource.  Call this once when the resource
    is created instead of open.  When complete, this will put the resource
    into the open state.
  */
  setup: function(done) {
    if (this.state !== Resource.START) {
      return done('resource cannot be setup once opened');
    }
    
    var rsrc = this;
    this._opener = Co.once(function(done) {
      rsrc.state = Resource.OPENING;
      rsrc.setupContent(function(err) {
        rsrc._opener = null; // don't run again
        if (err) {
          rsrc.state = Resource.ERROR;
          rsrc._error = err;
          done(err, rsrc);
        } else {
          rsrc.state = Resource.OPEN;
          done(null, rsrc);
        }
      });
    });
    this._opener(done || Co.noop);
    return this;
  },
  
  /**
    Opens the resource, invoking the done when open.  You can call this
    as often as you like - once a resource is opened this method will just
    invoke the done.
    
    @param {Function} done
      The done to invoke when opened
      
    @returns {void}
  */
  open: function(done) {
    var rsrc = this ;
    
    switch(this.state) {
      case Resource.ERROR:
        if (done) done(this._error, rsrc);
        break;
        
      case Resource.START:
      case Resource.CLOSED:
        this._opener = Co.once(function(done) {
          rsrc.state = Resource.OPENING;
          rsrc.readContent(function(err) {
            rsrc._opener = null ; // don't run again
            if (err) {
              rsrc.state = Resource.ERROR;
              rsrc._error = err;
              done(err, rsrc);
            } else {
              rsrc.state = Resource.OPEN;
              done(null, rsrc);
            }
          });
        });
        
        this._opener(done || Co.noop); // fire opener
        break;
        
      case Resource.OPENING:
        if (done) this._opener(done);
        break;
        
      case Resource.OPEN:
      case Resource.WRITING:
        if (done) done(null, rsrc); // already open just done
        break;
        
      // when opening while closing, wait until resource is closed and 
      // then open again.
      case Resource.CLOSING:
        this._closer(function(err) {
          if (err) {
            if (done) done(err, rsrc);
          } else {
            rsrc.open(done); // try again once closed
          }
        });
        break;
    }
    
    return this;
  },

  /**
    Closes a resource, possibly releasing the resource instance itself.
    You must match the same number of calls to open() with close() to fully
    destroy a resource.
  */
  close: function(done) {
    var rsrc = this ;
        
    switch(this.state) {
      case Resource.ERROR:
        if (done) done(this._error, rsrc);
        break;
        
      case Resource.OPEN:
        this._closer = Co.once(function(done) {
          rsrc.state = Resource.CLOSING;
          rsrc.releaseContent(function(err) {
            rsrc._closer = null ; // don't run again
            if (err) {
              rsrc.state = Resource.ERROR;
              rsrc._error = err;
              done(err, rsrc);
            } else {
              rsrc.state = Resource.CLOSED;
              done(null, rsrc);
            }
          });
        });
        
        this._closer(done || Co.noop); // always fire even with noop
        break;
        
      case Resource.CLOSING:
        if (done) this._closer(done);
        break;
        
      case Resource.START:
      case Resource.CLOSED:
        if (done) done(null, rsrc); // already open just done
        break;

      // when closing while opening, wait for opener to finish then fire
      case Resource.OPENING:
        this._closer(function(err) {
          if (err) {
            if (done) done(err, rsrc);
          } else {
            rsrc.close(done); // try again once closed
          }
        });
        break;
        
      // when closing while writing, wait for writer to finish then fire
      case Resource.WRITING:
        this._writer(function(err) {
          if (err) {
            if (done) done(err, rsrc);
          } else {
            rsrc.close(done); // try again once closed
          }
        });
        break;
    }
    
    return this;
  },
  
  /**
    Commits the current package database to disk.  Usually you won't need to
    call this method directly though you might override it.
  */
  write: function(done) {
    var rsrc = this ;
    
    switch(this.state) {
      case Resource.ERROR:
        if (done) done(this._error, rsrc); // can't write while in error 
        break;
        
      case Resource.OPEN:
        this._writer = Co.once(function(done) {
          rsrc.state = Resource.WRITING;
          rsrc.writeContent(function(err) {
            rsrc._writer = null ; // don't run again
            if (err) {
              rsrc.state = Resource.ERROR;
              rsrc._error = err;
              done(err, rsrc);
            } else {
              rsrc.state = Resource.OPEN;
              done(null, rsrc);
            }
          });
        });
        
        this._writer(done || Co.noop); // always fire even with noop
        break;
        
      // can't write while closing or closed or before opening
      case Resource.START:
      case Resource.CLOSING:
      case Resource.CLOSED:
        if (done) done("resource not open", rsrc);
        break;

      // if resource is opening or writing, wait until we leave the state 
      // and then try again.  This means each time you call write it will 
      // always fire another write
      case Resource.OPENING:
        this._opener(function(err) {
          if (err) {
            if (done) done(err, rsrc);
          } else {
            rsrc.write(done); // try again once closed
          }
        });
        break;
        
      case Resource.WRITING:
        this._writer(function(err) {
          if (err) {
            if (done) done(err, rsrc);
          } else {
            rsrc.write(done); // try again once closed
          }
        });
        break;
      
    }
    
    return this;
  },
  
  /**
    Reloads the resource by closing it first and then reopening 
  */
  reload: function(done) {
    this.close(function(err) {
      if (err) done(err, rsrc);
      else this.open(done);
    });
    return this;
  }
  
});

Resource.START   = 'start';
Resource.CLOSED  = 'closed';
Resource.OPENING = 'opening';
Resource.OPEN    = 'open';
Resource.CLOSING = 'closing';
Resource.WRITING = 'writing';
Resource.ERROR   = 'error';

exports = module.exports = Resource;
exports.Resource = Resource;
