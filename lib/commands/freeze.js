// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('private/co'),
    seed = require.seed;

exports.usage = 'freeze PACKAGE [OPTIONS]';
exports.summary = "Copy a seed package into the current working package";
exports.desc = [
'Copies a package into the current working project, effectively "freezing"',
'the version used by your project to the one currently installed.',
'\n\n',
'If a version of the package is already installed this will update to the',
'latest or named version of the package'].join('');

exports.options = [
['-w', '--working [PATH]', 'Working package (default is cwd)'],
['-V', '--version [VERSION]', 'Specify version to install'],
['-f', '--force', 'Overwrite any existing package'],
['-F', '--no-force', 'Do not overwrite any existing package (default)'],
['-d', '--dir [DIRNAME]', 'Alternate folder to freeze into (defaults "packages")']
];

// ..........................................................
// UTILITIES
// 

function freezePackage(workingPackage, vers, force, dirname) {

  // compute the root to install at
  var dstRoot = Co.path.join(workingPackage.path, dirname);
  var mkdstRoot = Co.once(function(done) {
    Co.fs.mkdir_p(dstRoot, 511, done);
  });
  
  return function(packageId, done) {
    seed.openPackage(packageId, vers, null, function(err, pkg) {
      if (!err && !pkg) {
        err = new Error(packageId+' '+vers+' not found');
      }
      if (err) return done(err);

      // make sure package does not exist already or we are forcing
      var dstPath = Co.path.join(dstRoot, pkg.name());
      (function(done) {
        Co.path.exists(dstPath, function(err, exists) {
          if (!err && exists && !force) {
            err = new Error(packageId+' already exists in working package.  Use --force to override');
          }
          if (err) return done(err);

          // delete package if it exists so we can replace it
          if (exists) {
            Co.verbose("Removing existing package at "+dstPath);
            Co.fs.rm_r(dstPath, Co.err(done));
          } else return done();
        });
        
      // if no error, do copy.
      })(function(err) {
        if (err) return done(err);
        mkdstRoot(function(err) {
          if (err) return done(err);
          Co.verbose("Copying "+pkg.path+" to "+dstPath);
          Co.fs.cp_r(pkg.path, dstPath, function(err) {
            if (err) return done(err);
            Co.println("Froze package "+packageId);
            done();
          });
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
      version = null,
      force   = false,
      dirname = 'packages';
      
  opts.on('working', function(k,v) { working = v; });
  opts.on('version', function(k,v) { version = v; });
  opts.on('force', function() { force = true; });
  opts.on('no-force', function() { force= false; });
  opts.on('dir', function(k,v) { dirname = v; });
  
  var packageIds = opts.parse(args); 

  if (packageIds.length===0) {
    return done(new Error("Package name required"));
  }

  if (version && packageIds.length>1) {
    return done(new Error("Only one package name allowed with version"));
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
      freezePackage(workingPackage, version, force, dirname)
    )(Co.err(done));
  });
};
