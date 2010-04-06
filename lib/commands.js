// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw new Error("Can only load from within seed");

var core = require('private/core');
var optparse = require('private/optparse');
var Cmds = exports;
var help = require('commands/help');

var STD_SWITCHES = [
  ['-h', '--help', 'Show help for this command'],
  ['-v', '--verbose', 'Activate verbose mode for debugging']
];
exports.STD_SWITCHES = STD_SWITCHES;


// ..........................................................
// UTILS USED BY COMMANDS
// 

function preferredSource() {
  // choose a repository to go to.  last source not a package.
  var repo,
      sources = require.sandbox.loader.sources;
  for(var loc=0;(loc<sources.length) && !repo; loc++) {
    if (sources[loc].acceptsInstalls) repo = sources[loc];
  }
  return repo;
}
exports.preferredSource = preferredSource;

// ..........................................................
// SUPPORT API
// 

// log some output but only if we are in verbose mode
Cmds.verbose = core.verbose;

// logs strings as a failed command and then exits done
Cmds.fail = core.fail;

/**
  Invokes callback with hash of plugin information
*/
Cmds.collectPluginInfo = function(key, packages) {
  var ret = {};
  if (!packages) packages = require.catalogPackages();
  packages.forEach(function(pkg) {
    var info = pkg.get(key);
    if (info) ret[pkg.id] = info;
  });
  
  return ret ;
};

/**
  Invokes callback with hash of commands mapped to property paths
*/
Cmds.commands = core.once(function(done) {
  var pluginInfo = Cmds.collectPluginInfo('seed:commands');
    
  var ret = core.mixin({}, pluginInfo['seed']);
  Object.keys(pluginInfo).forEach(function(packageId) {
    if (packageId === 'seed') return ; // skip since we put it there first
    
    var commands = pluginInfo[packageId];
    if (!commands) return ; // nothing to do
    
    for(var key in commands) {
      if (!commands.hasOwnProperty(key)) continue;
      var path = commands[key];
      if (path.indexOf(':')<0) path = packageId + ':' + path; // namespace 
      ret[key.toLowerCase()] = path;
    }
  });
  
  return done(null, ret);
});


/**
  Invokes a named command.  This will first go find all commands installed 
  on the system.
*/
Cmds.invoke = function(cmd, args, done) {
  if (arguments.length<2) throw new Error("invoke() requires least cmd and callback");

  if (!cmd) cmd = 'help';
  
  
  Cmds.commands(function(err, commands) {
    if (err) return done(err);
    var packageId = commands[cmd.toLowerCase()], exports;
    if (packageId) {
      try {
        exports = require(packageId);
      } catch(e) {
        exports = null;
      }
    }

    var opts = new optparse.OptionParser(STD_SWITCHES);
    
    if (!exports || !exports.invoke) {
      return Cmds.unknown(cmd, args, opts, done);
    } else {
      // ok try to parse the options and see if we need to do help
      var showHelp = false;
      opts.on('help', function() { showHelp = true; });
      opts.on('verbose', function() { require.env.VERBOSE = true; });
      opts.parse(args);
      if (showHelp) {
        return help.invoke(cmd, [cmd], opts, done);
      } else {
        opts = (exports.options || []).slice();
        opts = opts.concat(STD_SWITCHES);
        opts = new optparse.OptionParser(opts); 
        return exports.invoke(cmd, args, opts, done);
      }
    }
  });
};

Cmds.invokeSync = function(cmd, args) {  
  return core.wait(function(done) {
    Cmds.invoke(cmd, args, function(err) {
      if (err) core.println(err);
      return done();
    });
  });
};

/**
  Invoked whenever you call an unknown command
*/
Cmds.unknown = function(name, args, opts, done) {
  core.println("Command Unknown: " + name);
  help.invoke(null, [], opts, done);
};
