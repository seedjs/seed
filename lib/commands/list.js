// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var seed = require.seed;
var semver = require('semver');

exports.summary = "Lists installed packages and their versions";
exports.usage = "list [PACKAGE..PACKAGEn]";
exports.desc  = [
"Lists all the installed packages and their version. To list the information",
"about just a few of the packages, pass the package names on the command",
"line."].join(' ');

exports.invoke = function(cmd, args, opts, done) {
  args = opts.parse(args); // remove switches
  seed.packageList(function(err, list) {
    if (err) return done(err);
    
    var out = [];
    
    Object.keys(list).sort().forEach(function(packageId) {
      if ((args.length===0) || (args.indexOf(packageId)>=0)) {
        var vers = list[packageId];
        vers = vers.sort(function(a,b) { return semver.compare(a,b); });
        out.push(packageId+' ('+vers.join(',')+')');
      } 
    });
    
    Co.sys.puts(out.join("\n"));
    return done();
  });
};
