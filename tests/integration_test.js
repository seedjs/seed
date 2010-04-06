// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('./helpers');

Ct.module('seed integration test');
Ct.test('seed integration', function(t) {
  
  var seed = require('../index');
  t.ok(seed);
  
  var tiki = seed.require('tiki');
  t.ok(tiki);
  
  var test2 = seed.require('seed:core');
  t.ok(test2);
  
});

Ct.run();
