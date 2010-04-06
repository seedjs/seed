// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    Seed = require('../../seed').Seed,
    special = require('../../special-packages');

Ct.module('Seed#setup');

Ct.test('initial seed setup', function(t) {
  var seed = new Seed({ configureTest: 'FOO' });

  t.ok(seed.anonymousPackage instanceof special.AnonymousPackage, 
      'anonymous package');

  t.ok(seed.defaultPackage instanceof special.DefaultPackage, 
      'default package');
      
  t.ok(seed.sandbox, 'sandbox');
  t.equal(typeof seed.require, 'function', 'has seed.require()');
  
  t.equal(seed.get('configureTest'), 'FOO', 'has config');
  
});

Ct.run();
