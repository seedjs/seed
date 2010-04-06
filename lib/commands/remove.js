// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');
var Cmds = require('commands');
var preferredSource = require('commands').preferredSource;
var semver = require('tiki').semver;

exports.summary = "Remove an installed package";
exports.usage = 'remove PACKAGE [OPTIONS]';
exports.options = [
  ['-V', '--version VERSION', 'Version of package to remove'],
  ['-d', '--dependencies', 'Remove dependencies not used by other packages'],
  ['-D', '--no-dependencies', 'Do not also remove dependencies (default)']
];

exports.desc = [
'Removes an installed package from the local repository.',
'\n\nIf you name a specific version only that version will be removed.', 
'Otherwise removes any installed version.  If multiple versions are',
'installed you will be prompted to choose the version to remove.  This will', 'also remove any binaries'].join(' ');

exports.invoke = function(cmd, args, opts, done) {
  
  var includeDependencies = false;
  var vers = null;
  
  opts.on('dependencies', function() { includeDependencies = true; });
  opts.on('no-dependencies', function() { includeDependencies = false; });
  opts.on('version', function(key, v) { 
    vers = semver.normalize(v); 
  });
  
  var packageIds = opts.parse(args); // get list of packageIds
  var repo = preferredSource();
  if (!repo) {
    return Cmds.fail("Cannot find repository to install in", done);
  }
  Cmds.verbose("Removing from source ", repo.path);

  // get installed version information for each package
  CORE.iter.chain(function(done) {
    var ret = {}, canonicalId, pkg;
    
    if (vers) {
      
      canonicalId = repo.canonicalPackageId(packageIds[0], vers);
      pkg = canonicalId ? repo.packageFor(canonicalId) : null;
      if (!pkg) return done(null, {}); // no matching versions
      ret[packageIds[0]] = [pkg];
      
    } else {
      repo.catalogPackages().forEach(function(pkg) {
        var packageName = pkg.get('name');
        if (!ret[packageName]) ret[packageName] = [];
        ret[packageName].push(pkg);
      });
    }
      
    return done(null, ret);
  },
    
  // step through each packageId and remove
  function(packages, done) {
    
    CORE.iter.each(packageIds, function(packageId, done) {
      var versions = packages[packageId], pkg;
      
      // skip uninstalled versions
      if (!versions || (versions.length===0)) {
        if (vers) packageId = packageId + ' ' + vers;
        return Cmds.fail(packageId + ' is not installed', done);

      // one version is installed - just uninstall it
      } else if (versions.length===1) {
        pkg = versions[0];
        Cmds.verbose('removing ', packageId,' version: ', pkg.get('version'));
        repo.remove(pkg, done);
        
      // prompt for removal
      } else {
        CORE.println("Remove which version of " + packageId + "?");
        for(var idx=0;idx<versions.length;idx++) {
          CORE.println((idx+1) + '. ' + versions[idx].get('version'));
        }
        
        var last = versions.length+1;
        CORE.println((last) + '. All packages');
        CORE.println((last+1) + '. ' + (packageIds.length>1 ? 'Skip this package' : 'Cancel remove'));

        CORE.prompt(function(err, response) {
          CORE.prompt.done();
          
          response = Number(response);
          if (isNaN(response)) return CORE.println('Invalid Response');
          if (response > last) return done(); // skip
          
          // remove only one if single version selected
          if (response < last) versions = [versions[response-1]];
          CORE.iter.each(versions, function(pkg, done) {
            repo.remove(pkg, done);
          })(done);
        });
        
      }
      
    })(done);
    
  // success
  })(done);
};
