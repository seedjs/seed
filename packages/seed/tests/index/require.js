// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir fixturesDir */

process.mixin(require('../common'));

// make sure we always have reference to the node-native require() in case
// this is loaded from seed.
var nodeRequire = require.nodeRequire || require;

var seed = nodeRequire('index');
var Repository = require('repository');

// ..........................................................
// REQUIRE NODE MODULES
// 

// should find a built-in node library [i.e. does not exist on disk]
var fs2 = seed.require('fs');
assert.deepEqual(fs2, nodeRequire('fs'));

// should find on-disk node library
var http = seed.require('http');
assert.deepEqual(Object.keys(http).sort(), Object.keys(nodeRequire('http')).sort());

// ..........................................................
// REQUIRE FROM LOCAL PACKAGE
// 
var actual, expected;

// add local seed project
var seed2 = new seed.Seed('tmp');
var basicPath = path.join(fixturesDir, 'basic');

//seed2.LOG_DEBUG = true;
seed2.register(basicPath, function(err) {
  assert.equal(err, null);
});

// should find the bar module in the nested foo package
actual = seed2.require('foo:bar');
assert.ok(actual);
assert.equal(actual.name, 'foo:bar');

// ..........................................................
// REQUIRE FROM REPOSITORY
// 

var seed3 = new seed.Seed('tmp2'),
    demoRepoPath = path.join(fixturesDir, 'demo_repository');
    
var repo = Repository.open(demoRepoPath);
seed3.register(repo);

// should require latest foo
var foo = seed3.require('foo');
assert.ok(foo);
assert.equal(foo.VERSION, '2.0.0');

//seed3.LOG_DEBUG = true;
var bar = seed3.require('bar');
assert.ok(bar);
assert.equal(bar.VERSION, '3.2.1');
assert.ok(bar.foo);
assert.equal(bar.foo.VERSION, '1.2.1');

// ..........................................................
// CHAIN REPO & LOCAL PACKAGE
// 

var seed4 = new seed.Seed('tmp4');
seed4.register(repo);
seed4.register(basicPath);
//seed4.LOG_DEBUG = true;

foo = seed4.require('basic:foo');
assert.ok(foo); // should come from basic
assert.ok(foo.foo); // should get foo package
assert.equal(foo.foo.VERSION, '4.0.0'); // should use embedded 
