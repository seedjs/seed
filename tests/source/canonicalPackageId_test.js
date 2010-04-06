// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../source');

var SOURCE_PATH = help.path.join(help.FIXTURES_ROOT, 'test-source');

Ct.module('seed.Source#canonicalPackageId');
Ct.setup(function(t) {
  t.source = new seed.Source(SOURCE_PATH);
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test("should return for package found in source", function(t) {
  var expected = '::'+SOURCE_PATH+'/packages/bar/3.2.1';
  t.equal(t.source.canonicalPackageId('bar'), expected);
});

Ct.test("should return latest package when multiple version", function(t) {
  var expected = '::'+SOURCE_PATH+'/packages/foo/2.0.0';
  t.equal(t.source.canonicalPackageId('foo'), expected);
});

Ct.test("should return compatible package w/ multiple version", function(t) {
  var expected = '::'+SOURCE_PATH+'/packages/foo/1.2.1';
  t.equal(t.source.canonicalPackageId('foo', '1.0.0'), expected);
});

Ct.test("should return null when no matching version found", function(t) {
  t.equal(t.source.canonicalPackageId('foo', '2.1.0'), null);
  t.equal(t.source.canonicalPackageId('bar', '2.1.0'), null);
});

Ct.test("should return null when no package found", function(t) {
  t.equal(t.source.canonicalPackageId('imaginary'), null);
});




Ct.run();
