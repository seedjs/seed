// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================


var core = require('private/core');

// exports some core API
exports.FIXTURES_ROOT = core.path.join(core.SEED_ROOT, 'fixtures');
exports.path = core.path;
exports.fs   = core.fs;
exports.tiki = core.tiki;

// make a unit tmpdir just for this guy
if (!core.TMPDIR || core.TMPDIR.length===0) throw "no platform.TMPDIR";
exports.TMPDIR = core.path.join(core.TMPDIR, core.uuid());

// stage a fixture by copying it to the tmp directory.  
exports.stage = function(fixturePath) {
  var path = core.path.join.apply(core.path, arguments);

  var src = core.path.join(exports.FIXTURES_ROOT, path);
  var dst = core.path.join(exports.TMPDIR, path);
  
  if (!core.fs.exists(src)) throw 'stage fixtures '+path+' not found';
  core.fs.mkdir_p(core.path.dirname(dst), core.fs.A_RWX);
  core.fs.cp_r(src, dst);
  return dst;
};

exports.unstage = function(stagingPath) {
  var path = core.path.join.apply(core.path, arguments);
  var dst = core.path.join(exports.TMPDIR, path);
  if (core.fs.exists(dst)) core.fs.rm_r(dst);
};

exports.nativeRequire = core.nativeRequire;

exports.SEED_ROOT = core.SEED_ROOT;
