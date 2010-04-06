// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE   = require('private/core');
var SEMVER = require('tiki').semver;

exports.summary = "Lists installed packages and their versions";
exports.usage = "list [PACKAGE..PACKAGEn]";
exports.desc  = [
"Lists all the installed packages and their version. To list the information",
"about just a few of the packages, pass the package names on the command",
"line."].join(' ');

exports.options = [
['-d', '--detail', 'Show details about each package'],
['-r', '--remote', 'Show list information from remote']
];

// gets a string describing details for some package info
exports.detailsFor = function(pkg) {
  var ret = [''];
  ret.push(pkg.get('name')+' '+pkg.get('version'));
  
  var url = pkg.get('url');
  if (url) ret.push(url);
  ret.push('');
  
  var desc = pkg.get('description');
  if (desc) ret.push(desc+'\n');
  
  var keywords = pkg.get('keywords');
  if (keywords) ret.push('Keywords: '+keywords.join(','));
  
  var dependencies = pkg.get('dependencies');
  if (dependencies) {
    var deps = [];
    for(var key in dependencies) {
      if (!dependencies.hasOwnProperty(key)) continue;
      deps.push(key + ' ' + dependencies[key]);
    }
    ret.push('Dependencies: '+deps.join(', '));
  }
  
  var maintainer = pkg.get('maintainer');
  if (maintainer) ret.push('Maintainer: ' + maintainer);
  
  var author = pkg.get('author');
  if (author) ret.push('Author: ' + author);
  
  var contributors = pkg.get('contributors');
  if (contributors) ret.push('Contributors: ' + contributors.join(','));
  
  ret.push('');
  
  return ret.join('\n');
};

// takes either array of package or name+array of versions
exports.summaryFor = function(packages, vers) {
  if ('string' !== typeof packages) {
    vers = packages.map(function(pkg) { return pkg.get('version'); });
    packages = packages[0].get('name');
  }
  return packages+' ('+vers.join(',')+')';
};

/*
  Returns the details about a packageId and one or more version.  vers must be
  an array of versions.  We will look up that version specifically.
*/
function showDetails(packages) {
  var pkg, err, out;
  
  out = [];
  packages.forEach(function(pkg) {
    out.push(exports.detailsFor(pkg));
  }, this);
  return out.join('\n');
}

function showSummary(packages) {
  return exports.summaryFor(packages);
}

function semverSort(a,b) {
  return SEMVER.compare(a.get('version'), b.get('version'));
}

exports.invoke = function(cmd, args, opts, done) {
  var details = false, remote = null;
  opts.on('detail', function() { details = true; });
  opts.on('no-detail', function() { details = false; });
  opts.on('remote', function(k,v) { remote = v || true; });
  args = opts.parse(args); // remove switches

  // alias to seed remote list --remote
  if (remote) {
    if ('string' !== typeof remote) remote = null; 
    
    var state = { remote: remote, details: details };
    var REMOTE_CMD = require('commands/remote');
    return REMOTE_CMD.list(cmd, args, state, done);
  }
  
  // get list of all packages installed on seed and sort them by package name
  var catalog = require.catalogPackages(),
      packages = {}, packageName, versions, line;

  if (catalog && catalog.length>0) {

    catalog.forEach(function(pkg) {
      var packageName = pkg.get('name');
      if (!packageName || (packageName === '(default)') || (packageName === '(anonymous)')) return ;
      if (!packages[packageName]) packages[packageName] = [];
      packages[packageName].push(pkg);
    });

    for(packageName in packages) {
      if (!packages.hasOwnProperty(packageName)) continue;
      if (args.length>0 && args.indexOf(packageName)<0) continue;
      versions = packages[packageName];
      versions = versions.sort(semverSort);

      line = details ? showDetails(versions) : showSummary(versions);
      CORE.println(line);
    }
    
  } else {
    CORE.println('(No packages)');
  }
  return done();
};
