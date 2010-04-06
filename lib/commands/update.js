// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');

exports.usage   = 'update [PACKAGE]';
exports.summary = "Update an installed package";

// TODO: Implement
exports.invoke = function(cmd, args, opts, done) {
  return done(new Error('"seed update" is not yet implemented'));
};

