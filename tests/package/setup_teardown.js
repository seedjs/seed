// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir fixturesDir */

process.mixin(require('../common'));

var Package = require('package');
var Co = require('co');
var installingDir = path.join(fixturesDir, 'installing');

var pkg = Package.open(installingDir);

var cleanup = Co.parallel(['SETUP.out', 'TEARDOWN.out'], function(filename, done) {
  filename = path.join(installingDir, filename);
  Co.path.exists(filename, function(err, exists) {
    if (err) return done(err);
    if (exists) return Co.fs.rm(filename, done);
    else done();
  });
});

// first make sure the .out test files are gone
Co.chain(

  cleanup,
  
  // open package
  function(done) {
    Package.open(installingDir, done);
  },
  
  // try setup
  function(pkg, done) {
    pkg.setup(function(err) {
      if (err) throw err; // shouldn't happen
      
      var filename = Co.path.join(installingDir, 'SETUP.out');
      Co.path.exists(filename, function(err, exists) {
        if (err) throw err;
        assert.equal(exists, true);
        Co.fs.readFile(filename, function(err, content) {
          if (err) throw err;
          assert.equal(content, 'setup '+installingDir); // should be cwd.
          return done(null, pkg);
        });
      });
    });
  },
  
  // try teardown
  function(pkg, done) {
    pkg.teardown(function(err) {
      if (err) throw err; // shouldn't happen
      
      var filename = Co.path.join(installingDir, 'TEARDOWN.out');
      Co.path.exists(filename, function(err, exists) {
        if (err) throw err;
        assert.equal(exists, true);
        Co.fs.readFile(filename, function(err, content) {
          if (err) throw err;
          assert.equal(content, 'teardown '+installingDir); // should be cwd.
          return done();
        });
      });
    });
  },
  
  // cleanup again
  cleanup
)(function(err) { assert.equal(err, null); });
