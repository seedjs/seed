// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var REMOTE = require('remote');
var LIST_CMD = require('commands/list');

exports.summary = "Manage remote package sources";
exports.usage = "remote [SUBCOMMAND [REMOTE_URL]]";
exports.desc  = [
"Remote sources are used to discover and download packages when you use the",
"install command.  They are also used to push new packages when you use",
"the push command.  You can use this command to mange the remote sources",
"used by seed during these actions.",
"\n",
"\nTo use this command, you must also include one of the following",
"subcommands:",
"\n   show",
"\n        Shows the currently known remotes.  This is also the default if",
"\n        you do not include a subcommand at all",
"\n",
"\n    add REMOTE [--type MODULE]",
"\n        Adds the named remote URL to the list of remotes searched during",
"\n        package install.  You can name the module that should be used to",
"\n        access the remote with the --type switch.  Defaults to seed:remote",
"\n",
"\n    remove REMOTE",
"\n        Removes the named remote URL from the list of remotes searched",
"\n        during package install.",
"\n",
"\n    list [PACKAGE1..PACKAGEn] [--version VERSION] [--remote REMOTE]",
"\n        Retrieves a list of all packages available on the named remote.",
"\n        Optionally name a package and version to limit the search",
"\n",
"\n    login REMOTE [--username USERNAME] [--password PASSWORD]",
"\n        Obtains login credentials for the named remote so you can push",
"\n        new content.",
"\n",
"\n    logout REMOTE",
"\n        Forgets any login credentials for the named remote",
"\n",
"\n    stats REMOTE [PACKAGE1..PACKAGEn] [--version VERSION]",
"\n        Obtains the download stats for the named package or packages. If",
"\n        you indicate a version, retrieves stats only for that version.",
"\n        Otherwise retrieves stats for all versions of the named packages.",
"\n"].join(' ');

exports.options = [
  ['-V', '--version VERSION', 'Optional package version for list or stats command'],
  ['-U', '--username USERNAME', 'Optional username for login command'],
  ['-P', '--password PASSWORD', 'Optional password for login command'],
  ['-t', '--type TYPE', 'Optional type when adding a remote'],
  ['-r', '--remote REMOTE', 'Optional remote when listing'],
  ['-D', '--domain DOMAIN', 'Domain to write changes to'],
  ['-d', '--details', 'Show details when listing']];

var COMMAND_MAP = {
  'rm': 'remove'
};

exports.invoke = function(cmd, args, opts, done) {
  var state = { domain: 'local', type: 'seed:remote', details: false };
  ['version', 'username', 'password', 'domain', 'type', 'details', 'remote'].forEach(function(k) {
    opts.on(k, function(key, value) { state[k] = value; });
  });
  args = opts.parse(args);

  // get cmd and normalize
  cmd  = args.shift();
  if (!cmd) cmd = 'show';
  cmd = cmd.toLowerCase();
  if (COMMAND_MAP[cmd]) cmd = COMMAND_MAP[cmd];

  
  if (!exports[cmd]) {
    Co.sys.puts('Unknown command "remote '+cmd+'"\n');
    return require('commands/help').showCommand('remote', done);
  }
  
  exports[cmd](cmd, args, state, done);
};

// ..........................................................
// UTILS
// 

function remoteUrlRequired(done) {
  Co.sys.puts("Remote URL required");
  done();
}

// ..........................................................
// SHOW COMMAND
// 

exports.show = function(cmd, args, state, done) {
  REMOTE.config(function(err, remotes) {
    if (err) return done(err);
    if (remotes.length===0) {
      Co.sys.puts('(No remotes)');
    } else {
      remotes.forEach(function(remote) {
        Co.sys.puts(remote.url + ' ('+remote.moduleId+')');
      });
    }
    done();
  });
};

// ..........................................................
// ADD COMMAND
// 

exports.add = function(cmd, args, state, done) {
  var remoteUrl = args.shift();
  if (!remoteUrl) return remoteUrlRequired(done);
  remoteUrl = REMOTE.normalize(remoteUrl);
  
  var remoteType = state.type;

  REMOTE.config.add(state.domain, remoteUrl, remoteType, function(err,flag){
    if (err) return done(err);
    if (flag) Co.sys.puts('Added remote '+remoteUrl+' ('+remoteType+')');
    else Co.sys.puts('Remote '+remoteUrl+' already exists');
    return done();
  });
};

// ..........................................................
// REMOVE COMMAND
// 

exports.remove = function(cmd, args, state, done) {
  var remoteUrl = args.shift();
  if (!remoteUrl) return remoteUrlRequired(done);
  remoteUrl = REMOTE.normalize(remoteUrl);

  REMOTE.config.remote(state.domain, remoteUrl, function(err, flag) {
    if (err) return done(err);
    if (flag) Co.sys.puts("Removed remote "+remoteUrl);
    else Co.sys.puts(remoteUrl+" is not a remote in domain "+state.domain);
    return done();
  });
};

// ..........................................................
// LIST COMMAND
// 

exports.list = function(cmd, args, state, done) {
  var opts = {};
  if (args.length===1) {
    opts.name = args[0];
    opts.version = state.version;
  } else {
    opts.name = args;
  }

  // collect remote or remotes to search
  var remoteUrl = state.remote;
  var combinedPackages = {};
  
  Co.chain(function(done) {
    if (remoteUrl) {
      remoteUrl = REMOTE.normalize(remoteUrl);
      REMOTE.open(remoteUrl, function(err, remote) {
        if (err) return done(err);
        if (remote) return done(null, [remote]);
        
        // if remote is unknown assume it's the default type
        REMOTE.openRemote(remoteUrl, function(err, remote) {
          if (err) return done(err);
          return done(null, [remote]);
        });
        
      });
      
    } else {
      REMOTE.remotes(done);
    }
  },
  
  // search each remote, collecting results into a single hash
  function(remotes, done) {
    
    Co.reduce(remotes, {}, function(ret, remote, done) {  
      Co.verbose('Searching '+remote.url);
      remote.list(opts, function(err, packages) {
        if (err) return done(err);
        packages.forEach(function(info) {
          var name = info.name;
          combinedPackages[name] = info;

          if (!ret[name]) ret[name] = [];
          if (ret[name].indexOf(info.version)<0) ret[name].push(info.version);
        });
        return done(null, ret);
      });
    })(done);
  },
  
  // log out put
  function(info, packages, done) {
    var names = Object.keys(info).sort();
    names.forEach(function(name) {
      if (state.details) {
        Co.sys.puts(LIST_CMD.detailsFor(combinedPackages[name]));
      } else {
        Co.sys.puts(LIST_CMD.summaryFor(name, info[name]));
      }
    });
    return done();
  })(done);
};

// ..........................................................
// LOGIN
// 

// obtain a login token for the named remote
exports.login = function(cmg, args, state, done) {
  
};


