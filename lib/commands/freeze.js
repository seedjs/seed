// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');

exports.usage = 'freeze PACKAGE [--version=version] [--project=project]';
exports.summary = "Clones a seed into the current working project";
exports.desc = [
'Copies a package into the current working project, effectively "freezing"',
'the version used by your project to the one currently installed.',
'\n\n',
'If a version of the package is already installed this will update to the',
'latest or named version of the package'].join('');

exports.invoke = function(cmd, args, done) {
  Co.sys.debug('Cmds.freeze ' + Co.sys.inspect(args));
  return done();
};
