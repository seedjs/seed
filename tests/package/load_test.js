// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../package');

var BASIC_PATH = help.path.join(help.FIXTURES_ROOT, 'basic');
var Factory = help.tiki.Factory;

function addAlts(pkg) {
  pkg.getReaders = function() {
    return { 
      '.coffee': { id: 'coffee-script:seed-reader', pkg: null },
      '.js':     { id: 'seed:reader', pkg: null }
    };
  };
}

Ct.module('seed.Package#load');
Ct.setup(function(t) {
  t.pkg = new seed.Package('basic', BASIC_PATH);
  t.loader  = new help.tiki.Loader();
  t.sandbox = new help.tiki.Sandbox(t.loader);
});

Ct.teardown(function(t) {
  delete t.pkg;
  delete t.loader;
  delete t.sandbox;
});


Ct.test("finds existing modules", function(t) {
  t.ok(t.pkg.load('foo', t.sandbox) instanceof Factory, 'foo module');
  t.ok(t.pkg.load('bar', t.sandbox) instanceof Factory, 'bar module');
  t.ok(t.pkg.load('bar/baz', t.sandbox) instanceof Factory, 'bar/baz module');
});

Ct.test('does not find non-existing modules', function(t) {
  t.equal(t.pkg.load('imaginary', t.sandbox), null, 'imaginary module');
  t.equal(t.pkg.load('fig', t.sandbox), null, 'fig module (.coffee is not registered)');
});

Ct.test('finds alternate extensions', function(t) {
  addAlts(t.pkg);
  
  t.throws(function() {
    t.pkg.load('fig', t.sandbox);
  }, null, 'should throw exception because it can\'t find coffee-script reader');
});

Ct.test('finds extensions based on declared order', function(t) {
  addAlts(t.pkg);
  t.throws(function() {
    t.pkg.load('doubles/fig', t.sandbox);
  }, null, 'doubles/fig.coffee module');
});

Ct.test('finds in alternate directories', function(t) {
  t.ok(t.pkg.load('~test/a_test', t.sandbox) instanceof Factory, 'test/a_test');
});


Ct.run();
