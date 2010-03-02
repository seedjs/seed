// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir */

process.mixin(require('../common'));

var Package = require('package');
var pkgDir = path.dirname(libDir);

Package.open(pkgDir, function(err, pkg) {
  assert.equal(pkg.info('name'), 'seed', 'pkg.info(name)');

  assert.notEqual(pkg.info('description'), 'hello world');
  pkg.info('description', 'hello world');
  assert.equal(pkg.info('description'), 'hello world');  
});

