// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var preferredRepository = require('commands').preferredRepository;

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

exports.invoke = function(cmd, args, done) {
  var packageIds = args.slice(); // for now just slice.  process opts later
  var repo = preferredRepository();
  if (!repo) done("Cannot find repository to install in");

  // get installed version information for each package
  Co.chain(function(done) {
    repo.packageList(done);
  },
    
  // step through each packageId and remove
  function(versions, done) {
    Co.each(packageIds, function(packageId, done) {
      var version = versions[packageId];
      
      // skip uninstalled versions
      if (!version || (versions.length===0)) {
        Co.sys.debug(packageId + ' is not installed.');
        return done();

      // one version is installed - just uninstall it
      } else if (version.length===1) {
        Co.sys.debug('removing ' + packageId + ' version: ' + version[0]);
        
        repo.compatiblePackage(packageId, version[0], function(err,pkg) {
          if (err) return done(err);
          repo.remove(pkg, done);
        });
        
      // prompt for removal
      } else {
        Co.sys.puts("Remove which version of " + packageId + "?");
        for(var idx=0;idx<version.length;idx++) {
          Co.sys.puts((idx+1) + '. ' + version[idx]);
        }
        
        var last = version.length+1;
        Co.sys.puts((last) + '. All packages');
        Co.sys.puts((last+1) + '. ' + (packageIds.length>1 ? 'Skip this package' : 'Cancel remove'));

        Co.prompt(function(err, response) {
          response = Number(response);
          if (isNaN(response)) return Co.sys.puts('Invalid');
          if (response > last) return done(); // skip
          
          // remove only one if single version selected
          if (response < last) version = [version[response-1]];
          Co.each(version, function(v, done) {
            Co.sys.debug(v);
            repo.openPackage(packageId, v, function(err, pkg) {
              if (err) return done(err);
              repo.remove(pkg, done);
            });
          })(done);
        });
        
      }
      
    })(done);
    
  // success
  })(done);
};
