// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../source');

var SOURCE_PATH = help.path.join(help.FIXTURES_ROOT, 'test-source');

Ct.module('seed.Source#packageFor');
Ct.setup(function(t) {
  t.source = new seed.Source(SOURCE_PATH);
});

Ct.teardown(function(t) {
  delete t.source;
});

Ct.test("returns package for canonicalId", function(t) {
  var id, pkg;
  
  id = t.source.canonicalPackageId('bar', '=3.2.1');
  pkg = t.source.packageFor(id);
  t.ok(pkg);
  t.equal(pkg.get('name'), 'bar', 'pkg.name');
  t.equal(pkg.get('version'), '3.2.1', 'pkg.version');

  id = t.source.canonicalPackageId('foo');
  pkg = t.source.packageFor(id);
  t.ok(pkg);
  t.equal(pkg.get('name'), 'foo', 'pkg.name');
  t.equal(pkg.get('version'), '2.0.0', 'pkg.version');

  id = t.source.canonicalPackageId('foo', '=1.2.1');
  pkg = t.source.packageFor(id);
  t.ok(pkg);
  t.equal(pkg.get('name'), 'foo', 'pkg.name');
  t.equal(pkg.get('version'), '1.2.1', 'pkg.version');
});

Ct.test('returns null for missing package', function(t) {
  t.source.canonicalPackageId('imaginary'); // try to look it up
  t.equal(t.source.packageFor('imaginary'), null);
});

Ct.test('returns null for canonicalId we just made up', function(t) {
  // Dont lookup canonicalId first...
  t.equal(t.source.packageFor('::imaginary/big/package'), null);
});

Ct.run();