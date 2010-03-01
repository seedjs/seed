// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir */

process.mixin(require('./common'));

var semver = require('semver'), ret;

// semver.major()
assert.equal(semver.major('1.9.0'), 1);
assert.equal(semver.major('2.1.23beta'), 2);
assert.equal(semver.major('0002.2.0'), 2);
assert.equal(semver.major('2'), 2);

// semver.minor()
assert.equal(semver.minor('1.9.0'), 9);
assert.equal(semver.minor('2.1.23beta'), 1);
assert.equal(semver.minor('0002.0020.0'), 20);
assert.equal(semver.minor('2'), 0);
assert.equal(semver.minor('2.2'), 2);

// semver.patch() - needs === here to catch type diffs
assert.equal(semver.patch('1.9.0'), 0);
assert.equal(semver.patch('2.1.23beta'), '23beta');
assert.equal(semver.patch('0002.0020.00023'), 23);
assert.equal(semver.patch('2'), 0);
assert.equal(semver.patch('2.2'), 0);
assert.equal(semver.patch('2.2.1'), 1);

// semver.compare()
assert.equal(semver.compare('1.9.0', '1.10.0'), -1);
assert.equal(semver.compare('1.11.0', '1.10.0'), 1);
assert.equal(semver.compare('2.0.1', '1.10.0'),  1);
assert.equal(semver.compare('2.0.1', '2.0.1'), 0);

assert.equal(semver.compare('1.0.0beta1', '1.0.0beta2'), -1);
assert.equal(semver.compare('1.0.0', '1.0.0beta2'), 1);

assert.equal(semver.compare('1.0.0beta10', '1.0.0beta2'), 1);
assert.equal(semver.compare('1.0.0beta20.1', '1.0.0beta20.2'), -1);
assert.equal(semver.compare('1.0.0beta20.1', '1.0.0'), -1);

assert.equal(semver.compare('1.0.0beta1.9', '1.0.0beta100'), -1);

// semver.compatible()
assert.equal(semver.compatible('1.0.0', '1.0.0'), true);
assert.equal(semver.compatible('1.1.0', '1.0.0'), false);
assert.equal(semver.compatible('1.0.0', '1.0.0rc1'), false);
assert.equal(semver.compatible('1.0.0', '1.0.1000'), true);
assert.equal(semver.compatible('1.0.0', '1.5.2beta3'), true);
assert.equal(semver.compatible('1.0.0', '1.99.99'), true);
assert.equal(semver.compatible('1.0.0', '2.0.0'), false);
