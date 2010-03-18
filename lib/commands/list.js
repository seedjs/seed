// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('private/co');
var seed = require.seed;
var semver = require('semver');

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
exports.detailsFor = function(info) {
  var ret = [''];
  ret.push(info.name+' '+info.version);
  
  var url = info.url;
  if (url) ret.push(url);
  ret.push('');
  
  var desc = info.description;
  if (desc) ret.push(desc+'\n');
  
  var keywords = info.keywords;
  if (keywords) ret.push('Keywords: '+keywords.join(','));
  
  var dependencies = info.dependencies;
  if (dependencies) {
    var deps = [];
    for(var key in dependencies) {
      if (!dependencies.hasOwnProperty(key)) continue;
      deps.push(key + ' ' + dependencies[key]);
    }
    ret.push('Dependencies: '+deps.join(', '));
  }
  
  var maintainer = info.maintainer;
  if (maintainer) ret.push('Maintainer: ' + maintainer);
  
  var author = info.author;
  if (author) ret.push('Author: ' + author);
  
  var contributors = info.contributors;
  if (contributors) ret.push('Contributors: ' + contributors.join(','));
  
  ret.push('');
  
  return ret.join('\n');
};

exports.summaryFor = function(packageId, vers) {
  return packageId+' ('+vers.join(',')+')';
};

function showDetails(packageId, vers, done) {
  Co.map(vers, function(version, done) {

    seed.openPackage(packageId, version, null, function(err, pkg) {
      if (err) return done(err);
      return done(null, exports.detailsFor(pkg.info()));
    });
    
  })(function(err, out) {
    if (err) return done(err);
    return done(null, out.join('\n'));
  });
  
}

function showSummary(packageId, vers, done) {
  done(null, exports.summaryFor(packageId, vers));
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
  
  seed.packageList(function(err, list) {
    if (err) return done(err);
        
    Co.map(Object.keys(list).sort(), function(packageId, done) {
      
      if ((packageId==='seed')||(packageId==='seed-server')) return done();
      
      if ((args.length===0) || (args.indexOf(packageId)>=0)) {
        var vers = list[packageId];
        vers = vers.sort(function(a,b) { return semver.compare(a,b); });
        if (details) showDetails(packageId, vers, done);
        else showSummary(packageId, vers, done);
      } else done();

    })(function(err, lines) {
      if (err) return done(err);
      
      var out = [];
      lines.forEach(function(line) { 
        if (line) out.push(line); 
      });
      
      if (out.length===0) Co.println('(No packages)');
      else Co.println(out.join("\n"));
      
      return done();
    });
    
  });
};
