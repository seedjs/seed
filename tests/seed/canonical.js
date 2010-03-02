// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir  fixturesDir */

process.mixin(require('../common'));


var seed = require('index');
var basicPath = path.join(fixturesDir, 'basic');

// work in our own private version of seed
seed = new seed.Seed(); 
var basic = seed.register(basicPath); // lookup packages here

// ..........................................................
// TESTS
// 

// lookup inline modules [fs, events, path]
// lookup builtin module from node/lib [http]
['fs', 'events', 'path', 'http'].forEach(function(moduleId) {
  seed.canonical(moduleId, 'bar', basic, function(err, canonicalId) {
    assert.equal(canonicalId, '::default:'+moduleId);
  });
});

//seed.LOG_DEBUG = true;

// to be applied to tests
function doTest(moduleId, curModuleId, expectedPackageId, expectedModuleId) {
  
  // convert the expected packageId to a path.  This is what we expect to see
  var expected;
  if (expectedPackageId === 'basic') expected = basicPath;
  else expected = path.join(basicPath, 'packages', expectedPackageId);
  expected = '::' + expected + ':' + expectedModuleId;
  
  seed.canonical(moduleId, curModuleId, basic, function(err, canonicalId) {
    sys.puts('~ seed.canonical("'+[moduleId, curModuleId].join('","')+'")');
    assert.equal(err, null);
    assert.equal(canonicalId, expected);
    sys.puts('found: ' + canonicalId);
  });
}

// fully qualified
doTest('foo:bar', 'bar', 'foo','bar'); 
doTest('foo:bar/../baz', 'bar', 'foo','baz');

// relative
doTest('./foo', 'bar', 'basic', 'foo');
doTest('./foo', 'bar/baz', 'basic', 'bar/foo');
doTest('../foo', 'bar/baz', 'basic', 'foo');

// landing on another package
doTest('foopkg', 'bar', 'foopkg', 'index');

