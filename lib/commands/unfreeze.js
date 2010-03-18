// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('private/co'),
    seed = require.seed;

exports.usage = 'unfreeze PACKAGE [OPTIONS]';
exports.summary = "Remove a frozen package from working package";
exports.desc = [
'Removes any existing copy of the named package from the current working',
'package.  This will cause the working package to use install seeds instead',
'\n',
'\nIf the installed package has a .git or .svn directory inside of it',
'seed will not remove the package unless you use --force to avoid',
'accidentially deleting any custom changes you might have made'].join('');

exports.options = [
['-w', '--working [PATH]', 'Working package (default is cwd)'],
['-f', '--force', 'Remove package even if it is under source control'],
['-F', '--no-force', 'Do not remove package if it is under source control']
];

// ..........................................................
// UTILITIES
// 

var SRC_DIRS = ['.svn', '.git'];

function unfreezePackage(workingPackage, force) {

  return function(packageId, done) {
    workingPackage.compatiblePackage(packageId, null, function(err, pkg) {
      if (pkg === workingPackage) pkg = null; // can't delete self
      if (!err && !pkg) {
        err = new Error(packageId+' not frozen');
      }
      if (err) return done(err);
      
      // make sure the package is not under source control
      Co.find(SRC_DIRS, function(dirname, done) {
        Co.path.exists(Co.path.join(pkg.path, dirname), done);
      })(function(err, found) {
        if (!err && !!found && !force) {
          err = new Error(packageId+' is under source control.  Use --force to override');
        }
        if (err) return done(err);
        if (found) {
          Co.verbose(packageId+" is under source control.  Removing anyway");
        }
        Co.verbose("Removing "+pkg.path);
        Co.fs.rm_r(pkg.path, function(err) {
          if (err) return done(err);
          Co.println("Unfroze "+packageId);
          return done();
        });
      });
      
    });
  };
}

// ..........................................................
// COMMAND
// 
exports.invoke = function(cmd, args, opts, done) {
  
  var working = Co.cwd(),
      force   = false;
      
  opts.on('working', function(k,v) { working = v; });
  opts.on('force', function() { force = true; });
  opts.on('no-force', function() { force= false; });
  
  var packageIds = opts.parse(args); 

  if (packageIds.length===0) {
    return done(new Error("Package name required"));
  }

  // first we need to find the working package to install in
  (function(done) {
    working = Co.path.normalize(working);
    seed.openNearestPackage(working, function(err, workingPackage) {
      if (!err && !workingPackage) {
        err = new Error("working package could not be found for "+working);
      }
      if (err) return done(err);
      return done(null, workingPackage);
    });
    
  // next, find the packages for the packageId's in seed
  })(function(err, workingPackage) {
    if (err) return done(err);
    Co.verbose("Working package at "+workingPackage.path);
    Co.each(packageIds, 
      unfreezePackage(workingPackage, force)
    )(Co.err(done));
  });
};
