// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../package');

var BASIC_PATH = help.path.join(help.FIXTURES_ROOT, 'basic');

function addAlts(pkg) {
  pkg.getReaders = function() {
    return { 
      '.coffee': { id: 'coffee-script:seed-reader', pkg: null },
      '.js':     { id: 'seed:reader', pkg: null }
    };
  };
}

Ct.module('seed.Package#exists');
Ct.setup(function(t) {
  t.pkg = new seed.Package('basic', BASIC_PATH);
  t.sandbox = new help.tiki.Sandbox();
});

Ct.teardown(function(t) {
  delete t.pkg;
});


Ct.test("finds existing modules", function(t) {
  t.ok(t.pkg.exists('foo'), 'foo module');
  t.ok(t.pkg.exists('bar'), 'bar module');
  t.ok(t.pkg.exists('bar/baz'), 'bar/baz module');
  
});

Ct.test('does not find non-existing modules', function(t) {
  t.ok(!t.pkg.exists('imaginary'), 'imaginary module');
  t.ok(!t.pkg.exists('fig'), 'fig module (.coffee is not registered)');
});

Ct.test('finds alternate extensions', function(t) {
  addAlts(t.pkg);
  t.ok(t.pkg.exists('fig'), 'fig.coffee module');
});

Ct.test('finds extensions based on declared order', function(t) {
  addAlts(t.pkg);
  t.ok(t.pkg.exists('doubles/fig'), 'doubles/fig.coffee module');
});

Ct.test('finds in alternate directories', function(t) {
  t.ok(t.pkg.exists('~test/a_test'), 'test/a_test');
});


Ct.run();
