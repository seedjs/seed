// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir */

process.mixin(require('../common'));

var Package = require('package');

Package.openGlobalConfig(function(err, config1) {
  assert.equal(err, null);
  assert.ok(config1, 'should have config');
  
  config1.attr('version', '0.0.1');
  
  // try again
  Package.openGlobalConfig(function(err, config2) {
    assert.equal(err, null); // no error
    assert.equal(config2, config1); // return same config
  });
});
