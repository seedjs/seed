// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process __filename*/

// common setup for unit testing

var path = require("path");

exports.testDir = path.dirname(__filename);
exports.fixturesDir = path.normalize(path.join(exports.testDir, "..", "fixtures"));
exports.libDir = path.join(exports.testDir, "../lib");

// add lib dir but only if it is already added...
if (require.paths.indexOf(exports.libDir) < 0) {
  require.paths.unshift(exports.libDir);
}

var assert = require('assert');

exports.sys = require('sys');
exports.assert = require('assert');
exports.fs = require("fs");
exports.path = path;
