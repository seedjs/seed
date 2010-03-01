// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir  fixturesDir */

process.mixin(require('../common'));


var Repository = require('repository');
var demoPath = path.join(fixturesDir, 'demo_repository');

Repository.open(demoPath, function(err, rep) {
  rep.LOG_DEBUG = true;
  
  rep.compatiblePackage('imaginary', null, function(err, foundPackage) {
    assert.equal(foundPackage, null); // should not find non-existant pkg
  });
  
  // should return latest with no version
  rep.compatiblePackage('foo', null, function(err, foundPackage) {
    assert.ok(foundPackage); // should have one
    assert.equal(foundPackage.version(), '2.0.0');
  });

  // should limit if versioned
  rep.compatiblePackage('foo', '1.1', function(err, foundPackage) {
    assert.ok(foundPackage); // should have one
    assert.equal(foundPackage.version(), '1.2.1');
  });

  // should return null if versions out of range
  rep.compatiblePackage('foo', '3.0.0', function(err, foundPackage) {
    assert.ok(!foundPackage); // should have one
  });
  
});