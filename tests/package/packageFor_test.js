// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../package');

var BASIC_PATH = help.path.join(help.FIXTURES_ROOT, 'basic');

Ct.module('seed.Package#canonicalPackageId');
Ct.setup(function(t) {
  t.pkg = new seed.Package('basic', BASIC_PATH);
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test("should return itself for its own name", function(t) {
  t.strictEqual(t.pkg.packageFor('::basic', null), t.pkg);
});

Ct.test('should return nested packages', function(t) {
  t.strictEqual(t.pkg.packageFor('::basic/packages/foo').id, '::basic/packages/foo');
  t.equal(t.pkg.packageFor('::basic/packages/foopkg').id, '::basic/packages/foopkg');
});

Ct.test('should return null for missing packages', function(t) {
  t.equal(t.pkg.packageFor('::basic/packages/bar'), null);
});

Ct.run();
