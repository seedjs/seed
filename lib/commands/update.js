// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var core = require('private/core');

exports.usage   = 'update [PACKAGE]';
exports.summary = "Update an installed package";

exports.invoke = function(cmd, args, opts, done) {
  core.debug('Cmds.update ' + core.inspect(args));
  return done();
};

