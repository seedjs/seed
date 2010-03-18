// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys t libDir */

var semver = require('semver');
var Ct = require('core_test:sync');

Ct.module('semver');

Ct.test('semver.major()', function(t) {
  t.equal(semver.major('1.9.0'), 1);
  t.equal(semver.major('2.1.23beta'), 2);
  t.equal(semver.major('0002.2.0'), 2);
  t.equal(semver.major('2'), 2);
});

Ct.test('semver.minor()', function(t) {
  t.equal(semver.minor('1.9.0'), 9);
  t.equal(semver.minor('2.1.23beta'), 1);
  t.equal(semver.minor('0002.0020.0'), 20);
  t.equal(semver.minor('2'), 0);
  t.equal(semver.minor('2.2'), 2);
});

// needs === here to catch type diffs
Ct.test('semver.patch()', function(t) {
  t.equal(semver.patch('1.9.0'), 0);
  t.equal(semver.patch('2.1.23beta'), '23beta');
  t.equal(semver.patch('0002.0020.00023'), 23);
  t.equal(semver.patch('2'), 0);
  t.equal(semver.patch('2.2'), 0);
  t.equal(semver.patch('2.2.1'), 1);
});

Ct.test('semver.compare()', function(t) {
  t.equal(semver.compare('1.9.0', '1.10.0'), -1);
  t.equal(semver.compare('1.11.0', '1.10.0'), 1);
  t.equal(semver.compare('2.0.1', '1.10.0'),  1);
  t.equal(semver.compare('2.0.1', '2.0.1'), 0);

  t.equal(semver.compare('1.0.0beta1', '1.0.0beta2'), -1);
  t.equal(semver.compare('1.0.0', '1.0.0beta2'), 1);

  t.equal(semver.compare('1.0.0beta10', '1.0.0beta2'), 1);
  t.equal(semver.compare('1.0.0beta20.1', '1.0.0beta20.2'), -1);
  t.equal(semver.compare('1.0.0beta20.1', '1.0.0'), -1);

  t.equal(semver.compare('1.0.0beta1.9', '1.0.0beta100'), -1);
});

Ct.test('semver.compatible()', function(t) {
  t.equal(semver.compatible('1.0.0', '1.0.0'), true);
  t.equal(semver.compatible('1.1.0', '1.0.0'), false);
  t.equal(semver.compatible('1.0.0', '1.0.0rc1'), false);
  t.equal(semver.compatible('1.0.0', '1.0.1000'), true);
  t.equal(semver.compatible('1.0.0', '1.5.2beta3'), true);
  t.equal(semver.compatible('1.0.0', '1.99.99'), true);
  t.equal(semver.compatible('1.0.0', '2.0.0'), false);
});

Ct.run();
