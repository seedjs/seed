// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co = require('./co');
var Package = require('./package');
var semver = require('./semver');

var seed = require.seed || require('./index'); // depends on how we're invoked
var Cmds = exports;

// ..........................................................
// LIST COMMAND
// 

Cmds.list = function(cmd, args, done) {
  seed.packageList(function(err, list) {
    if (err) return done(err);
    
    var out = [];
    
    Object.keys(list).sort().forEach(function(packageId) {
      if ((args.length===0) || (args.indexOf(packageId)>=0)) {
        var vers = list[packageId];
        vers = vers.sort(function(a,b) { return semver.compare(a,b); });
        out.push(packageId+' ('+vers.join(',')+')');
      } 
    });
    
    Co.sys.puts(out.join("\n"));
    return done();
  });
};
Cmds.list.summary = "Lists installed packages and their versions";
Cmds.list.usage = "list [PACKAGE] [VERSION]";
Cmds.list.desc  = [
"Lists all the installed packages and their version. To list the information",
"about just a few of the packages, pass the package names on the command",
"line."].join(' ');

// ..........................................................
// INSTALL COMMAND
// 

Cmds.install = function(cmd, args, done) {
  
  var packageIds = args.slice(); // for now just slice.  process opts later

  // choose a repository to go to.  last source not a package.
  var repo,
      sources = seed.sources;
  for(var loc=0;(loc<sources.length) && !repo; loc++) {
    if (sources[loc].acceptsInstalls) repo = sources[loc];
  }
  if (!repo) done("Cannot find repository to install in");
  
  // first process all packages - each one should be converted into an array
  // of paths to install.  [array so that we can expand to include depends]
  Co.chain(Co.collect(packageIds, function(packageId, done) {
    done(null, Co.path.normalize(packageId));
  }),
  
  // next reduce to a single flattened array
  function(paths, done) {
    var ret = [];
    paths.forEach(function(curPaths) {
      if ('string' === typeof curPaths) {
        ret.push(curPaths);
      } else {
        curPaths.forEach(function(path) { ret.push(path); });
      }
    });
    
    done(null, ret);
  },
  
  // and then attempt to load each as a package
  function(paths, done) {
    Co.collect(paths, function(path, done) {
      Package.open(path, done);
    })(done);
  },
  
  // finally, use package info to install into repository
  function(packages, done) {
    Co.each(packages, function(pkg, done) {
      repo.install(pkg, done);
    })(done);
    
  // success!
  })(done);
};

Cmds.install.summary = "Install or update a package";
Cmds.install.usage = "install [PACKAGE..PACKAGEn]";
Cmds.install.desc = [
"Installs one or more packages, including any dependencies, from a local or",
"remote source.  Pass the names of one or more packages to discover them on",
"a remote server or pass a filename of an existing package to install it.",
"\n\n",
"For local packages, you can reference either the package directory or a zip", "or seed of the package"].join(' ');

// ..........................................................
// REMOVE COMMAND
// 

Cmds.remove = function(cmd, args, done) {
  Co.sys.debug('Cmds.remove ' + Co.sys.inspect(args));
  return done();
};
Cmds.remove.summary = "Remove an installed package";

// ..........................................................
// UPDATE COMMAND
// 

Cmds.update = function(cmd, args, done) {
  Co.sys.debug('Cmds.update ' + Co.sys.inspect(args));
  return done();
};
Cmds.update.summary = "Update an installed package";

// ..........................................................
// HELP COMMAND
// 

// cool trick...
var SPACES_ARRAY = [];
function spaces(cnt) {
  SPACES_ARRAY.length = cnt+1;
  return SPACES_ARRAY.join(' ');
}

Cmds.help = function(name, args, done) {
  var text = [
    "Seed v"+module.pkg.version() + ' Flexible Package Manager for Node.js',
    "",
    "usage: seed COMMAND [ARGS]",
    "",
    "Installed commands:"];
  
  Cmds.commands(function(err, commands) {
    if (err) return done(err);
    var summaries = Object.keys(commands).sort().map(function(cmd) {
      var packageId = commands[cmd];
      var exports   = require(packageId);
      if (!exports || !exports[cmd]) {
        return [cmd, 'not found in '+packageId];
      } else {
        return [cmd, exports[cmd].summary || 'no summary'];
      }
    });
    
    // format into columns
    var maxLen = summaries.reduce(function(prev, curStr) {
      return Math.max(prev, curStr[0].length);
    }, 0);
    
    summaries.forEach(function(summary) {
      text.push('   '+ summary[0] + spaces(3+maxLen-summary[0].length) + summary[1]);
    });

    text.push('');
    Co.sys.puts(text.join("\n"));
    return done();
  });
};
Cmds.help.summary = "Show this help message";


// ..........................................................
// SUPPORT API
// 

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

  Cmds.commands(function(err, commands) {
    if (err) return done(err);
    var packageId = commands[cmd.toLowerCase()];
    if (!packageId) {
      Cmds.unknown.apply(cmd, args, done);
    } else {
      var exports = require(packageId);
      if (!exports) Cmds.unknown.apply(cmd, args, done);
      else exports[cmd](cmd, args, done);
    } 
  });
};

Cmds.invokeSync = function(cmd, args) {  
  return Co.wait(function(done) {
    Cmds.invoke(cmd, args, done);
  });
};

/**
  Invoked whenever you call an unknown command
*/
Cmds.unknown = function(name, args, done) {
  Co.sys.puts("Command Unknown: " + name);
  Cmds.help(null, done);
};
