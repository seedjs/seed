// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var optparse = require('optparse');
var Cmds = exports;
var seed = require.seed;
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
      sources = seed.sources;
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
Cmds.verbose = Co.verbose;

// logs strings as a failed command and then exits done
Cmds.fail = Co.fail;

/**
  Invokes callback with hash of plugin information
*/
Cmds.collectPluginInfo = Co.once(function(done) {
  var seedPackage = module.pkg || seed.seedPackage;
  seed.preferredPackageList(seedPackage, function(err, list) {
    if (err) return done(err);
    Co.reduce(Object.keys(list), {}, function(ret, packageId, done) {
      seed.openPackage(packageId, function(err, pkg) {
        if (err) return done(err);
        var config = pkg.info('seed'); // look for a seed config
        if (config) ret[packageId] = config;
        return done(null, ret);
      });
    })(done);
  });
});

/**
  Invokes callback with hash of commands mapped to property paths
*/
Cmds.commands = Co.once(function(done) {
  Cmds.collectPluginInfo(function(err, pluginInfo) {
    if (err) return done(err);
    
    var ret = Co.mixin({}, pluginInfo['seed'].commands);
    Object.keys(pluginInfo).forEach(function(packageId) {
      if (packageId === 'seed') return ; // skip since we put it there first
      
      var commands = pluginInfo[packageId].commands;
      if (!commands) return ; // nothing to do
      
      for(var key in commands) {
        if (!commands.hasOwnProperty(key)) continue;
        var path = commands[key];
        if (path.indexOf(':')<0) path = packageId + ':' + path; // namespace 
        ret[key.toLowerCase()] = path;
      }
    });
    
    done(null, ret);
  });
});


/**
  Invokes a named command.  This will first go find all commands installed 
  on the system.
*/
Cmds.invoke = function(cmd, args, done) {
  if (arguments.length<2) throw "invoke() requires least cmd and callback";

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
      opts.on('verbose', function() { process.env.VERBOSE = true; });
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
  return Co.wait(function(done) {
    Cmds.invoke(cmd, args, function(err) {
      if (err) Co.sys.puts(err);
      return done();
    });
  });
};

/**
  Invoked whenever you call an unknown command
*/
Cmds.unknown = function(name, args, opts, done) {
  Co.sys.puts("Command Unknown: " + name);
  help.invoke(null, [], opts, done);
};
