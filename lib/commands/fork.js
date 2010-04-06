// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');
    

exports.usage = 'fork PACKAGE [OPTIONS]';
exports.summary = "Clones the package from source into your packages";
exports.desc = [
'If a package defined a git source, you can use this command to easily',
'create a clone of the package and copy it into your working package so you',
'can hack on it.',
'\n',
'\nIf are using github, you can also provide a github username and a fork',
'of the project will be created for you on github as well'].join('');

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

function forkPackage(workingPackage, vers, force, dirname) {

  // compute the root to install at
  var dstRoot = CORE.path.join(workingPackage.path, dirname);
  
  return function(packageId, done) {
    var pkg = require.packageFor(packageId, vers);
    var repo;

    if (!pkg) {
      return done(new Error(packageId+' '+vers+' not found'));
    }

    // find a matching repository
    repo = pkg.get('repositories').filter(function(r) { 
      return r.type && (r.type.toLowerCase() === 'git');
    })[0];
    if (!repo) {
      return done(new Error(packageId+' does not list a git repository in its package info.  Try just freezing instead.'));
    }
      
    if (repo.path) {
      return done(new Error('Cannot fork nested packages. '+packageId+' is found at '+repo.path+ ' inside '+repo.url+'. Try cloning manually.'));
    }
      
    // make sure package does not exist already or we are forcing
    var dstPath = CORE.path.join(dstRoot, pkg.get('name'));
    (function(done) {
      if (!CORE.fs.exists(dstPath)) return done();  // nothing to do
      
      if (!force) {
        return done(new Error(packageId+' already exists in working package.  Use --force to override'));
      }

      // delete package if it exists so we can replace it
      CORE.verbose("Removing existing package at "+dstPath);
      CORE.fs.rm_r(dstPath, CORE.err(done));
        
    // if no error, do copy.
    })(function(err) {
      if (err) return done(err);
      CORE.fs.mkdir_p(dstRoot, CORE.fs.A_RWX);
      CORE.verbose("Cloning "+repo.url+" to "+dstPath);
        
      var cmd = 'cd '+CORE.path.dirname(dstPath)+'; git clone '+repo.url+' '+CORE.path.basename(dstPath);
        
      // we need to use ChildProcess so we can stream output as it 
      // comes
      CORE.fs.exec(cmd, true, function(err) {
        if (err) return done(err);
        CORE.println("Forked package "+packageId);
        return done();
      });
    });
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
    var workingPackage = require.loader.openNearestPackage(working);
    if (!workingPackage) {
      return done(new Error("working package could not be found for "+working));
    }
    return done(null, workingPackage);
    
  // next, find the packages for the packageId's in seed
  })(function(err, workingPackage) {
    if (err) return done(err);
    CORE.verbose("Working package at "+workingPackage.path);
    CORE.iter.each(packageIds, 
      forkPackage(workingPackage, version, force, dirname)
    )(CORE.err(done));
  });
};
