// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals __dirname */

// Need to use nodeRequire() explicitly until Seed loader can handle native 
// extensions

var nodeRequire = require.nodeRequire || require;
var Co = require('./co');

var path = Co.path.normalize(Co.path.join(__dirname, '..', '..','loop'));
module.exports = nodeRequire(path);

