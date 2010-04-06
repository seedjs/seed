// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');

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
  var dstRoot = CORE.path.join(workingPackage.path, dirname);
  var mkdstRoot = CORE.once(function(done) {
    CORE.fs.mkdir_p(dstRoot, 511, done);
  });
  
  return function(packageId, done) {
    CORE.async(function() {
      var pkg, dstPath;
      
      // find the requested package in the repos
      pkg = require.packageFor(packageId, vers);
      if (!pkg) throw new Error(packageId+' '+vers+' not found');

      // remove existing copy if forced or throw error
      dstPath = CORE.path.join(dstRoot, pkg.get('name'));
      if (CORE.fs.exists(dstPath)) {
        if (!force) {
          throw new Error(packageId+' already exists in working package.  Use --force to override');
        }
        
        CORE.verbose("Removing existing package at "+dstPath);
        CORE.fs.rm_r(dstPath);
      }

      // copy package into target
      CORE.fs.mkdir_p(dstRoot, CORE.fs.A_RWX);
      CORE.verbose("Copying "+pkg.path+" to "+dstPath);
      pkg.copy(dstPath, function(err) {
        if (err) return done(err);
        CORE.println("Froze package "+packageId);
        return done();
      });
      
    })(done);
  };
}

// ..........................................................
// COMMAND
// 
exports.invoke = function(cmd, args, opts, done) {
  
  var working = CORE.cwd(),
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
    working = CORE.path.normalize(working);
    CORE.async(function() {
      return require.loader.openNearestPackage(working);
    })(function(err, workingPackage) {
      if (!err && !workingPackage) {
        err = new Error("working package could not be found for "+working);
      }
      return err ? done(err) : done(null, workingPackage);
    });
    
  // next, find the packages for the packageId's in seed
  })(function(err, workingPackage) {
    if (err) return done(err);
    CORE.verbose("Working package at "+workingPackage.path);
    CORE.iter.each(packageIds, 
      freezePackage(workingPackage, version, force, dirname)
    )(CORE.err(done));
  });
};
