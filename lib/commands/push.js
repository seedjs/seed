// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');
var Cmds = require('commands');
var Package = require('package').Package;
var REMOTE = require('remote');

exports.summary = "Push a new package to a remote";
exports.usage = 'push [PACKAGE] [--remote REMOTE] [--username USERNAME]';
exports.options = [
  ['-r', '--remote REMOTE', 'Remote to push to'],
  ['-U', '--username USERNAME', 'Optional username']
];

exports.desc = [
'Pushes a package to a remote.  If you don\'t name a path then the current',
'working directory will be used as the package.  If you don\'t name a remote',
'then the most recently added remote will be used'].join(' ');


exports.invoke = function(cmd, args, opts, done) {
  var paths, remote, username;
  
  opts.on('remote', function(k,v) { remote = v; });
  opts.on('username', function(k,v) { username = v; });
  
  paths = opts.parse(args);
  if (paths.length === 0) paths = [process.cwd()];

  if (remote) remote = REMOTE.normalize(remote);
  
  // select a remote to push to
  CORE.iter.chain(function(done) {
    if (remote) {
      REMOTE.open(remote, done);
    } else {
      REMOTE.remotes(function(err, remotes) {
        var idx=0, lim = remotes.length;
        for(idx=0;!remote && idx<lim;idx++) {
          remote = remotes[idx];
        }
        return done(null, remote);
      });
    }

  // push to remote
  }, function(remote, done) {
    if (!remote) return done('No remote found');
    CORE.iter.parallel(paths, function(path, done) {
      path = CORE.path.normalize(path);
      var pkg = require.packageFor(path); 
      if (!pkg) return done(path + " is not a valid package");
      CORE.println("Pushing "+pkg.get('name')+' '+pkg.get('version')+"...");
      CORE.verbose("  Pushing to remote " + remote.url);
      remote.push(pkg, username, CORE.err(done));
      
    })(done);
    
  })(done);
};