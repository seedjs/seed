// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');

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
    var canonicalId, pkg, err, isUnderSourceControl;
    
    canonicalId = workingPackage.canonicalPackageId(packageId, null);
    if (canonicalId) pkg = workingPackage.packageFor(canonicalId);
    
    if (pkg === workingPackage) pkg = null; // can't delete self
    if (!pkg) {
      return done(new Error(packageId+' not frozen'));
    }
      
    // make sure the package is not under source control
    isUnderSourceControl = SRC_DIRS.some(function(dirname) {
      return CORE.fs.exists(CORE.path.join(pkg.path, dirname));
    });
    
    if (isUnderSourceControl) {
      if (!force) {
        return done(new Error(packageId+' is under source control.  Use --force to override'));
      } else {
        CORE.verbose(packageId+" is under source control.  Removing anyway");
      }
    }

    CORE.verbose("Removing "+pkg.path);
    CORE.fs.rm_r(pkg.path);
    CORE.println("Unfroze "+packageId);
    return done();
  };
}

// ..........................................................
// COMMAND
// 
exports.invoke = function(cmd, args, opts, done) {
  
  var working = CORE.cwd(),
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
    working = CORE.path.normalize(working);
    CORE.async(function() {
      return require.loader.openNearestPackage(working);
    })(function(err, workingPackage) {
      if (!err && !workingPackage) {
        err = new Error("working package could not be found for "+working);
      }
      if (err) return done(err);
      return done(null, workingPackage);
    });
    
  // next, find the packages for the packageId's in seed
  })(function(err, workingPackage) {
    if (err) return done(err);
    CORE.verbose("Working package at "+workingPackage.path);
    CORE.iter.each(packageIds, 
      unfreezePackage(workingPackage, force)
    )(CORE.err(done));
  });
};
