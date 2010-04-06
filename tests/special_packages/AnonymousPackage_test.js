// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../special-packages'),
    Factory = require('../../reader').Factory;

Ct.module('seed.AnonymousPackage');
Ct.setup(function(t) {
  t.pkg = new seed.AnonymousPackage();
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test('any absolute path should exist', function(t) {
  
  // existing path
  var path1 = help.path.join(help.FIXTURES_ROOT, 'basic', 'lib', 'bar.js');
  
  // imaginary path
  var path2 = help.path.join(help.FIXTURES_ROOT, 'basic', 'lib', 'not-it.js');
  
  t.equal(t.pkg.exists(path1), true, 'exists('+path1+')');
  t.equal(t.pkg.exists(path2), false, 'exists('+path1+')');

  t.ok(t.pkg.load(path1).call, 'load('+path1+')');
  t.equal(t.pkg.load(path2), null, 'load('+path2+')');
  
});

Ct.run();