// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir  fixturesDir */

process.mixin(require('../common'));


var Repository = require('repository');
var demoPath = path.join(fixturesDir, 'demo_repository');

var r1, r2;
function shouldBeSame(rep) {
  if (!r1) r1 = rep;
  else assert.equal(rep, r1);
}

r2 = Repository.open(demoPath, function(err, rep) {
  shouldBeSame(rep);

  var r3 = Repository.open(demoPath, function(err, rep) {
    shouldBeSame(rep);
    assert.equal(rep.info('option'), 'hasit');
  });
  shouldBeSame(r3);
});

shouldBeSame(r2);