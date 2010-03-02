// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir __filename */

process.mixin(require('../common'));

var Co = require('co');

// ..........................................................
// EXISTS
// 
// make sure Co.path.exists() includes an 'err' param to callback.

sys.puts('exists ' + __filename);
Co.path.exists(__filename, function(err, exists) {
  assert.equal(exists, true, 'should return true');
});

var path = Co.path.join('imaginary','file.foo');

sys.puts('exists ' + path);
Co.path.exists(path, function(err, exists) {
  assert.equal(exists, false, 'should return false');
});


// ..........................................................
// NORMALIZE
// 

// normalize should expand a ~
var expected = Co.path.join(process.env.HOME, 'foo');
assert.equal(Co.path.normalize('~/foo'), expected);
