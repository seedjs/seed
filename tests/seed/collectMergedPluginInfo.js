// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global __dirname */

var seed = require('index'),
    Co   = require('private/co');
var Ct = require('core_test');


Ct.module("Seed#collectMergedPluginInfo");

var loadersPackage;
Ct.setup(function(t, done) {
  var path = Co.path.normalize(Co.path.join(__dirname, '..', '..', 'fixtures', 'loaders'));
  seed.openPackage(path, function(err, pkg) {
    if (err) return done(err);
    loadersPackage = pkg;
    done();
  });
});

Ct.test("should find all loader plugins", function(t, done) {
  
  seed.collectMergedPluginInfo(loadersPackage, 'seed-loader', function(err, info) {
    t.ok(!err, 'should not have an error');
    t.deepEqual(Object.keys(info).sort(), ['.coffeescript', '.js'], 'info.keys');
    t.equal(info['.js'], 'seed:loader', 'info[.js]');
    t.equal(info['.coffeescript'], 'loaders:coffeescript', 'info[.coffeescript]');
    done();
  });
});

Ct.run();
