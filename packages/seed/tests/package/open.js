// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir */

process.mixin(require('../common'));

var Package = require('package');
var projectPath = path.normalize(path.join(libDir, '..', '..', '..'));

var p1, base;
 
function testSame(pkg) {
  if (!base) base = pkg;
  else assert.equal(pkg, base);
}

p1 = Package.open(projectPath, function(err, pkg) {
  assert.equal(err, null); // should not return an error
  assert.equal(pkg.name(), path.basename(projectPath)); // name since no info
  testSame(pkg);
  
  var p2 = Package.open(projectPath, function(err, pkg2) {  
    assert.equal(pkg2, pkg);
    testSame(pkg2);
  });
  testSame(p2);
});
testSame(p1);