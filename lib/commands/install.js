// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var Package = require('package');
var preferredRepository = require('commands').preferredRepository;

exports.summary = "Install or update a package";
exports.usage = "install [PACKAGE..PACKAGEn] [OPTIONS]";
exports.options = [
  ['-V', '--version VERSION', 'Version of package to install'],
  ['-s', '--source SOURCE', 'Preferred source to use for installing'],
  ['-d', '--dependencies', 'Install missing dependencies (default)'],
  ['-D', '--no-dependencies', 'Do not install missing dependencies']
];

exports.desc = [
"Installs one or more packages, including any dependencies, from a local or",
"remote source.  Pass the names of one or more packages to discover them on",
"a remote server or pass a filename of an existing package to install it.",
"\n",
"\nFor local packages, you can reference either the package directory or a zip", "or seed of the package"].join(' ');

exports.invoke = function(cmd, args, opts, done) {
  
  var packageIds = opts.parse(args);
  var repo = preferredRepository();
  if (!repo) done("Cannot find repository to install in");
  
  // first process all packages - each one should be converted into an array
  // of paths to install.  [array so that we can expand to include depends]
  Co.chain(Co.collect(packageIds, function(packageId, done) {
    done(null, Co.path.normalize(packageId));
  }),
  
  // next reduce to a single flattened array
  function(paths, done) {
    var ret = [];
    paths.forEach(function(curPaths) {
      if ('string' === typeof curPaths) {
        ret.push(curPaths);
      } else {
        curPaths.forEach(function(path) { ret.push(path); });
      }
    });
    
    done(null, ret);
  },
  
  // and then attempt to load each as a package
  function(paths, done) {
    Co.collect(paths, function(path, done) {
      Package.open(path, done);
    })(done);
  },
  
  // finally, use package info to install into repository
  function(packages, done) {
    Co.each(packages, function(pkg, done) {
      repo.install(pkg, done);
    })(done);
    
  // success!
  })(done);
};

