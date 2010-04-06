// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../package');

var BASIC_PATH = help.path.join(help.FIXTURES_ROOT, 'basic');
var WITH_LOCAL_PATH = help.path.join(help.FIXTURES_ROOT, 'with_local');

// ..........................................................
// GET|SET - NO LOCAL
// 

Ct.module('seed.Package#get|set (no local.json)');
Ct.setup(function(t) {
  t.pkg = new seed.Package('basic', BASIC_PATH);
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test('reading a few built-in configs', function(t) {
  t.equal(t.pkg.get('name'), 'basic', 'pkg.get(name)');
  t.equal(t.pkg.get('version'), '0.1.0', 'pkg.get(version)');  
  
  // verify that unknown/nonstandard keys are handled
  t.equal(t.pkg.get('seed:pass-through'), 'not modified', 'pkg.get(seed:pass-through)');
  
});

// just test that we invoke normalize here.  The normalize module will do the
// rest.
Ct.test('reading a normalized config', function(t) {
  t.pkg.normalize = function(k, v) {
    return 'NORMALIZED';
  };
  t.equal(t.pkg.get('name'), 'NORMALIZED', 'pkg.get(name)');
  t.equal(t.pkg.get('version'), 'NORMALIZED', 'pkg.get(version)');  
  
});

Ct.test('reading from local domain', function(t) {
  t.equal(t.pkg.get('name', seed.Package.LOCAL), 'basic', 'get(name, LOCAL) should work even if there is no local.json');
});


Ct.test('writing a config', function(t) {
  t.equal(t.pkg.get('biff'), null, 'PRECOND - no biff');
  t.pkg.set('biff', 'baz', seed.Package.PACKAGE);
  t.equal(t.pkg.get('biff'), 'baz', 'pkg.get(biff)');
});

Ct.test('writing a config to a local domain', function(t) {
  t.equal(t.pkg.get('biff'), null, 'PRECOND - no biff');
  t.pkg.set('biff', 'baz', seed.Package.LOCAL);
  t.pkg.set('biff', 'bar', seed.Package.PACKAGE);
  t.equal(t.pkg.get('biff'), 'baz', 'pkg.get(biff, LOCAL)');
  t.equal(t.pkg.get('biff', seed.Package.PACKAGE), 'bar', 'pkg.get(biff, PKG)');
});

Ct.test('writing should NORMALIZE', function(t) {
  t.pkg.normalize = function(k, v, writing) {
    if (writing) return 'NORMALIZED';
    return v;
  };
  
  t.pkg.set('biff', 'baz');
  t.equal(t.pkg.get('biff'), 'NORMALIZED' ,'should be normalized');
});

// ..........................................................
// GET LOCAL JSON
// 

Ct.module('seed.Package#get (w/ local.json)');
Ct.setup(function(t) {
  t.pkg = new seed.Package('with_local', WITH_LOCAL_PATH);
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test('reading local configs', function(t) {
  t.equal(t.pkg.get('name'), 'with_local', 'pkg.get(name) - not in local');
  t.equal(t.pkg.get('testProperty'), 'local', 'pkg.get(testProperty) - in local');
});

Ct.test('reading with domain', function(t) {
  t.equal(t.pkg.get('name', seed.Package.PACKAGE), 'with_local', 'pkg.get(name, PACKAGE)');
  t.equal(t.pkg.get('name', seed.Package.LOCAL), 'with_local', 'pkg.get(name, LOCAL) should pass through to global when not defined');

  t.equal(t.pkg.get('testProperty', seed.Package.PACKAGE), 'package', 'pkg.get(name, PACKAGE)');
  
  // note - different domain should return a different value... caching!
  t.equal(t.pkg.get('testProperty', seed.Package.LOCAL), 'local', 'pkg.get(name, LOCAL) should use local if defined');
});




Ct.run();