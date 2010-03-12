// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

// Need to use nodeRequire() explicitly until Seed loader can handle native 
// extensions

var nodeRequire = require.nodeRequire || require;
module.exports = nodeRequire('../../build/default/loop');

