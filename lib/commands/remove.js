// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var preferredRepository = require('commands').preferredRepository;
var semver = require('semver');

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
  var repo = preferredRepository();
  if (!repo) done("Cannot find repository to install in");

  // get installed version information for each package
  Co.chain(function(done) {
    if (vers) {
      repo.openPackage(packageIds[0], vers, function(err, pkg) {
        if (err || !pkg) {
          return done(null, {}); // no matching versions
        } else {
          var ret = {};
          ret[packageIds[0]] = [vers];
          return done(null, ret);
        } 
      });
      
    } else return repo.packageList(done);
  },
    
  // step through each packageId and remove
  function(versions, done) {
    Co.each(packageIds, function(packageId, done) {
      var version = versions[packageId];
      
      // skip uninstalled versions
      if (!version || (versions.length===0)) {
        if (vers) packageId = packageId + ' ' + vers;
        Co.sys.debug(packageId + ' is not installed.');
        return done();

      // one version is installed - just uninstall it
      } else if (version.length===1) {
        Co.sys.debug('removing ' + packageId + ' version: ' + version[0]);
        
        repo.openPackage(packageId, version[0], function(err,pkg) {
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
