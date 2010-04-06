// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../package');

var BASIC_PATH = help.path.join(help.FIXTURES_ROOT, 'basic');

// ..........................................................
// NORMALIZE
// 

Ct.module('seed.Package#normalize()');
Ct.setup(function(t) {
  t.pkg = new seed.Package('basic', BASIC_PATH);
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test('directories = null', function(t) {
  var expects = {
    'lib': ['lib'],
    'test': ['test', 'tests', 'spec'],
    'bin': ['bin'],
    'packages': ['packages']
  };
  
  var actual = t.pkg.normalize('directories', null);

  t.deepEqual(actual, expects);
});

Ct.test('directories = { alt: foo }', function(t) {
  var expects = {
    'lib': ['lib'],
    'test': ['test', 'tests', 'spec'],
    'bin': ['bin'],
    'packages': ['packages'],
    'alt': ['foo']
  };
  
  var actual = t.pkg.normalize('directories', { alt: 'foo' });

  t.deepEqual(actual, expects);
});

Ct.test('directories = { lib: foo, packages: [bar] }', function(t) {
  var expects = {
    'lib': ['foo'],
    'test': ['test', 'tests', 'spec'],
    'bin': ['bin'],
    'packages': ['bar']
  };
  
  var actual = t.pkg.normalize('directories', { 
    lib: 'foo', 
    packages: ['bar'] 
  });

  t.deepEqual(actual, expects);
});

Ct.test('directories = { tests: tester  }', function(t) {
  var expects = {
    'lib': ['lib'],
    'test': ['tester'],
    'tests': ['tester'],
    'bin': ['bin'],
    'packages': ['packages']
  };
  
  var actual = t.pkg.normalize('directories', { 
    tests: 'tester'
  });

  t.deepEqual(actual, expects);
});

Ct.test('directories = { lib: 23 }', function(t) {
  t.throws(function() {
    t.pkg.normalize('directories', { lib: 23 }); // no non-string
  });
});


Ct.run();