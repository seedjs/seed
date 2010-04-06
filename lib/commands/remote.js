// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw new Error("Can only load from within seed");

var CORE     = require('private/core'),
    REMOTE   = require('remote'),
    LIST_CMD = require('commands/list');

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
"\n"].join(' ');

exports.options = [
  ['-V', '--version VERSION', 'Optional package version for list or stats command'],
  ['-U', '--username USERNAME', 'Optional username for login command'],
  ['-P', '--password PASSWORD', 'Optional password for login command'],
  ['-t', '--type TYPE', 'Optional type when adding a remote'],
  ['-r', '--remote REMOTE', 'Optional remote when listing'],
  ['-d', '--details', 'Show details when listing']];

var COMMAND_MAP = {
  'rm': 'remove'
};

exports.invoke = function(cmd, args, opts, done) {
  var state = { domain: 'local', type: 'seed:remote', details: false };
  ['version', 'username', 'password', 'type', 'details', 'remote'].forEach(function(k) {
    opts.on(k, function(key, value) { state[k] = value; });
  });
  args = opts.parse(args);
  
  // get cmd and normalize
  cmd  = args.shift();
  if (!cmd) cmd = 'show';
  cmd = cmd.toLowerCase();
  if (COMMAND_MAP[cmd]) cmd = COMMAND_MAP[cmd];
  
  
  if (!exports[cmd]) {
    CORE.println('Unknown command "remote '+cmd+'"\n');
    return require('commands/help').showCommand('remote', done);
  }
  
  exports[cmd](cmd, args, state, done);
};

// ..........................................................
// UTILS
// 

function remoteUrlRequired(done) {
  CORE.println("Remote URL required");
  done();
}

// ..........................................................
// SHOW COMMAND
// 

exports.show = function(cmd, args, state, done) {
  var remotes = REMOTE.config();
  if (remotes.length===0) {
    CORE.println('(No remotes)');
  } else {
    remotes.forEach(function(remote) {
      CORE.println(remote.url + ' ('+remote.plugin+')');
    });
  }
};

// ..........................................................
// ADD COMMAND
// 

exports.add = function(cmd, args, state, done) {
  var remoteUrl = args.shift();
  if (!remoteUrl) return remoteUrlRequired(done);
  remoteUrl = REMOTE.normalize(remoteUrl);
  
  var remoteType = state.type;
  var flag, err;
  
  try {
    flag = REMOTE.config.add(remoteUrl, remoteType);
  } catch(e) {
    err = e;
  }

  if (err) return done(err);
  if (flag) CORE.println('Added remote '+remoteUrl+' ('+remoteType+')');
  else CORE.println('Remote '+remoteUrl+' already exists');
  done();
};

// ..........................................................
// REMOVE COMMAND
// 

exports.remove = function(cmd, args, state, done) {
  var remoteUrl = args.shift();
  if (!remoteUrl) return remoteUrlRequired(done);
  remoteUrl = REMOTE.normalize(remoteUrl);

  var flag, err;
  
  try {
    flag = REMOTE.config.remove(remoteUrl);
  } catch(e) {
    err = e;
  }
  
  if (err) return done(err);
  if (flag) CORE.println("Removed remote "+remoteUrl);
  else CORE.println(remoteUrl+" is not a remote in domain "+state.domain);
  return done();
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
  
  CORE.iter.chain(function(done) {
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
    
    CORE.iter.reduce(remotes, {}, function(ret, remote, done) {  
      CORE.verbose('Searching '+remote.url);
      remote.list(opts, function(err, packages) {
        if (!err && !packages) {
          err = new Error("Server sent an invalid response");
        }
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
    if (names.length === 0) return done('(No packages)');
    
    names.forEach(function(name) {
      if (state.details) {
        name = new CORE.tiki.Package(name, combinedPackages[name]);
        CORE.println(LIST_CMD.detailsFor(name));
      } else {
        CORE.println(LIST_CMD.summaryFor(name, info[name]));
      }
    });
    return done();
  })(done);
};

// ..........................................................
// LOGIN
// 

function remoteFor(remoteUrl, done) {
  if (remoteUrl) {
    remoteUrl = REMOTE.normalize(remoteUrl);
    REMOTE.open(remoteUrl, function(err, remote) {
      if (err) return done(err);
      if (remote) return done(null, remote);
      
      // if remote is unknown assume it's the default type
      REMOTE.openRemote(remoteUrl, function(err, remote) {
        if (err) return done(err);
        return done(null, remote);
      });
      
    });
    
  } else {
    REMOTE.remotes(function(err, remotes) {
      if (err) return done(err);
      return done(null, remotes[0]);
    });
  }
}

// obtain a login token for the named remote
exports.login = function(cmg, args, state, done) {
  var usernames = state.username ? [state.username] : null;
  remoteFor(state.remote, function(err, remote) {
    if (err || !remote) return done(err || '(No Remote)');
    return remote.login(usernames, CORE.err(done));
  });
};

// ..........................................................
// LOGOUT
// 

// obtain a login token for the named remote
exports.logout = function(cmg, args, state, done) {
  var usernames = state.username ? [state.username] : null;
  remoteFor(state.remote, function(err, remote) {
    if (err || !remote) return done(err || '(No Remote)');
    return remote.logout(usernames, CORE.err(done));
  });
};

// ..........................................................
// SIGNUP
// 

// Create a new account on a remote
exports.signup = function(cmd, args, state, done) {
  remoteFor(state.remote, function(err, remote) {
    if (err || !remote) return done(err || '(No Remote)');
    return remote.signup(CORE.err(done));
  });
};
