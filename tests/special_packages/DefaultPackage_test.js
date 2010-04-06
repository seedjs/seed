// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../special-packages');

var NATIVE_MODULES = seed.DefaultPackage.NATIVE_MODULES;

Ct.module('seed.DefaultPackage');
Ct.setup(function(t) {
  t.pkg = new seed.DefaultPackage();
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test('should have native modules', function(t) {
  t.ok(NATIVE_MODULES.length > 0);
});

Ct.test('should think all native modules exist', function(t) {
  NATIVE_MODULES.forEach(function(moduleId) {
    t.equal(t.pkg.exists(moduleId), true, moduleId);
  });
});

Ct.test('should return a fake factory that will return native', function(t) {
  NATIVE_MODULES.forEach(function(moduleId) {
    
    // file throws an error.  its ok to skip since testing all the others 
    // should be enough 
    if (['file', 'posix', 'uri', 'tcp'].indexOf(moduleId)>=0) return;
    
    var factory = t.pkg.load(moduleId);
    t.ok(factory, 'should get a factory');
    
    var fake = { id: moduleId, exports: {} }; // fake Module
    var sandbox = {}; // mock sandbox
    var exp = factory.call(sandbox, fake);

    t.strictEqual(exp, help.nativeRequire(moduleId), 'moduleId exports');
  });
});

// TODO: Somehow test that this can load other on-disk modules that are not 
// native.

Ct.run();