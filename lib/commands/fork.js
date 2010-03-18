// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */

if (!require.seed) throw "Can only load from within seed";

var Co = require('private/co'),
    seed = require.seed;

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
  var dstRoot = Co.path.join(workingPackage.path, dirname);
  var mkdstRoot = Co.once(function(done) {
    Co.fs.mkdir_p(dstRoot, 511, done);
  });
  
  return function(packageId, done) {
    seed.openPackage(packageId, vers, null, function(err, pkg) {
      var repo;

      if (!err && !pkg) {
        err = new Error(packageId+' '+vers+' not found');
      }
      if (err) return done(err);

      // find a matching repository
      repo = pkg.info('repositories').filter(function(r) { 
        return r.type && (r.type.toLowerCase() === 'git');
      })[0];
      if (!repo) {
        err = new Error(packageId+' does not list a git repository in its package info.  Try just freezing instead.');
        return done(err);
      }
      
      if (repo.path) {
        err = new Error('Cannot fork nested packages. '+packageId+' is found at '+repo.path+ ' inside '+repo.url+'. Try cloning manually.');
        return done(err);
      }
      
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
          Co.verbose("Cloning "+repo.url+" to "+dstPath);
          
          var cmd = 'cd '+Co.path.dirname(dstPath)+'; git clone '+repo.url+' '+Co.path.basename(dstPath);
          
          // we need to use ChildProcess so we can stream output as it 
          // comes
          var child = process.createChildProcess('/bin/sh', ['-c', cmd]);
          child.addListener('output', Co.print);
          child.addListener('error', Co.print);
          child.addListener('exit', function(code) {
            if (code !== 0) {
              return done(new Error("Command failed"));
            }

            Co.println("Forked package "+packageId);
            return done();
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
      forkPackage(workingPackage, version, force, dirname)
    )(Co.err(done));
  });
};
