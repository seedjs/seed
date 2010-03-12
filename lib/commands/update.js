// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');

exports.usage   = 'update [PACKAGE]';
exports.summary = "Update an installed package";

exports.invoke = function(cmd, args, opts, done) {
  Co.sys.debug('Cmds.update ' + Co.sys.inspect(args));
  return done();
};

