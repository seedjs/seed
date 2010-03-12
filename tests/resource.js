// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir  __filename */

process.mixin(require('./common'));

var Resource = require('resource'), 
    Co       = require('private/co');
    
// simple concrete implementation
var File = Co.extend(Resource, {
  
  readDelay: 0,
  readCount: 0,
  readContent: function(callback) {
    if (this.readDelay) {
      var file = this;
      setTimeout(function() { file._readContent(callback); }, file.readDelay);
    } else this._readContent(callback);
  },
  
  _readContent: function(callback) {
    this.readCount++;
    
    var repo = this;
    Co.fs.readFile(repo.path, function(err, content) {
      if (err) return callback(err);
      repo.content = content;
      callback(null); // ok!
    });
  },

  writeDelay: 0,
  writeCount: 0,
  writeContent: function(callback) {
    if (this.writeDelay) {
      var file = this;
      setTimeout(function() { file._writeContent(callback); }, this.writeDelay);
    } else this._writeContent(callback);
  },
  
  _writeContent: function(callback) {
    this.writeCount++;
    callback(null);
  },

  releaseDelay: 0,
  releaseCount: 0,
  releaseContent: function(callback) {
    var delay;
    if (delay = this.releaseDelay) {
      var file = this;
      setTimeout(function() { file._releaseContent(callback); }, delay);
    } else this._releaseContent(callback);
  },
    
  _releaseContent: function(callback) {
    this.releaseCount++;
    this.content = null;
    callback(null);
  }
  
});

function timeout(desc, after, target, method, callback) {
  var didRun = false, timer;
  method.call(target, function(err) {
    didRun = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    callback(err);
  });
  
  timer = setTimeout(function() {
    assert.ok(didRun, ('timeout: ' + desc));
  }, after);
}

// ..........................................................
// OPEN
// 

function testOpen() {
  var f = new File(__filename);
  f.readDelay = 100; // make sure we take awhile to stress test

  assert.equal(f.readCount, 0);
  timeout('f.open', 500, f, f.open, function(err) {
    assert.equal(err, null, 'should not have error');
    assert.ok(f.content, 'should have content');
    assert.equal(f.readCount, 1, 'should have invoked reader');

    // wait until read is done and try again
    timeout('f.open2', 500, f, f.open, function(err) {
      assert.equal(err, null, 'should not have error');
      assert.ok(f.content, 'should have content');
      assert.equal(f.readCount, 1, 'should not invoke reader again');
      assert.equal(f.state, Resource.OPEN, 'state should be open');
    });

  });

  assert.equal(f.state, Resource.OPENING, 'state should be opening after call');

  // calling open again immediately should just queue it up to invoke later
  timeout('f.open', 500, f, f.open, function(err) {
    assert.ok(f.content, 'should have content');
    assert.equal(f.readCount, 1, 'should not invoke reader again');
  });
  
}

// ..........................................................
// CLOSE
// 

function testClose() {
  var f = new File(__filename);
  f.releaseDelay = 100;
  
  f.open(function(err) {
    assert.equal(err, null, 'should not have error on open');
    
    // now close the file
    timeout('f.close', 500, f, f.close, function(err) {
      assert.equal(err, null);
      assert.equal(f.state, Resource.CLOSED, 'should be closed');
      assert.equal(f.releaseCount, 1, 'should invoke release');
      
      timeout('f.close', 500, f, f.close, function(err) {
        assert.equal(err, null, 'should not have an error on closing');
        assert.equal(f.state, Resource.CLOSED, 'should be closed');
        assert.equal(f.releaseCount, 1, 'should not invoke release again');
      });
    });
    
    assert.equal(f.state, Resource.CLOSING, 'should be closing immediately after');
    timeout('f.close', 500, f, f.close, function(err) {
      assert.equal(err, null, 'should not have an error on closing');
      assert.equal(f.state, Resource.CLOSED, 'should be closed');
      assert.equal(f.releaseCount, 1, 'should queue release');
    });

  });
  
}

// ..........................................................
// WRITING
// 

function testWrite() {
  var f = new File(__filename);
  f.writeDelay = 100;
  
  f.open(function(err) {
    assert.equal(err, null, 'should not have error on open');
    
    // now close the file
    timeout('f.write', 500, f, f.write, function(err) {
      assert.equal(err, null);
      assert.equal(f.state, Resource.OPEN, 'should be open again');
      assert.equal(f.writeCount, 1, 'should invoke write');
      
      timeout('f.write', 500, f, f.write, function(err) {
        assert.equal(err, null, 'should not have an error on write');
        assert.equal(f.state, Resource.OPEN, 'should be open again');
        assert.equal(f.writeCount, 2);
      });
    });
    
    assert.equal(f.state, Resource.WRITING, 'should be writing immediately after');

    timeout('f.write', 500, f, f.write, function(err) {
      assert.equal(err, null, 'should not have an error on write');
      assert.equal(f.state, Resource.OPEN, 'should be open');
      assert.equal(f.writeCount, 3);
    });

  });
    
}

// all tests can run in parallel
testOpen();
testClose();
testWrite();


