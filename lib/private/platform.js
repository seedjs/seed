// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see license.txt)
// ==========================================================================
/*globals process __filename */

var core = require('../private/core'),
    platform = exports;

// TODO: Detect the JS platform and add methods here to support the specific
// required items.

// TODO: Document specifically the methods that must be supported.


var NATIVE_MODULES;

// cur 0.1.33
if (process.binding) {
  NATIVE_MODULES = Object.keys(process.binding('natives'));
  
// prev 0.1.32
} else {
  NATIVE_MODULES = ['fs', 'events'];
}
NATIVE_MODULES.push('path');
platform.NATIVE_MODULES = NATIVE_MODULES;

// unknown platform support    
platform.path = core.nativeRequire('path');

platform.fs   = core.nativeRequire('fs');
platform.sys  = core.nativeRequire('sys');
platform.http = core.nativeRequire('http');
platform.url  = core.nativeRequire('url');
platform.querystring = core.nativeRequire('querystring');

// get the root directory for seed based on the current filename
platform.SEED_ROOT = platform.path.normalize(
  platform.path.join(__filename, '..', '..', '..'));

platform.env = process.env;
platform.args = process.args || process.argv;

platform.compile = process.compile;
platform.TMPDIR = process.env.TMPDIR;
platform.cwd = process.cwd;

var mod;
mod = core.nativeRequire('child_process');
platform.exec = function (command, echo, callback) {
  var child = mod.spawn("/bin/sh", ["-c", command]);
  var stdout = "";
  var stderr = "";

  child.stdout.setEncoding('utf8');
  child.stdout.addListener("data", function (chunk) { 
    if (echo) core.print(chunk);
    stdout += chunk; 
  });

  child.stderr.setEncoding('utf8');
  child.stderr.addListener("data", function (chunk) { 
    if (echo) core.print(chunk);
    stderr += chunk; 
  });

  child.addListener("exit", function (code) {
    child.stdin.end();
    if (code === 0) {
      if (callback) callback(null, stdout, stderr);
    } else {
      var e = new Error("Command failed: " + stderr);
      e.code = code;
      if (callback) callback(e, stdout, stderr);
    }
  });
};

var path = platform.path.join(__filename, '..', '..', '..', 'build', 'default', 'loop');
path = platform.path.normalize(path);
var LOOP = core.nativeRequire(path);

exports.loop = LOOP.loop;
exports.unloop = LOOP.unloop;

// ..........................................................
// STDIO
// 

exports.addStdinListener = function(callback) {
  process.openStdin().addListener('data', callback);
};

exports.closeStdin = function(callback) {
  process.openStdin().close();
};

