// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw new Error("Can only load from within seed");

var CORE = require('private/core'),
    Cmds = require('commands'),
    optparse = require('private/optparse');

exports.summary = "Show this help message";

// cool trick...
var SPACES_ARRAY = [];
function spaces(cnt) {
  SPACES_ARRAY.length = cnt+1;
  return SPACES_ARRAY.join(' ');
}

function showAllHelp(done) {
  var vers = module.ownerPackage.get('version');
  var text = [
    "Seed v"+vers+' Flexible Package Manager for Node.js',
    "",
    "usage: seed COMMAND [ARGS]",
    "",
    "Installed commands:"];
  
  Cmds.commands(function(err, commands) {
    if (err) return done(err);
    var summaries = Object.keys(commands).sort().map(function(cmd) {
      var packageId, exports, err;
      
      packageId = commands[cmd];
      try {
        exports = require(packageId);
      } catch(e) {
        err = e;
      }

      if (err) {
        return [cmd, 'load error in '+packageId+':\n  '+err];

      } else if (!exports || !exports.invoke) {
        return [cmd, 'not found in '+packageId];
      } else {
        return [cmd, exports.summary || 'no summary'];
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
    CORE.println(text.join("\n"));
    return done();
  });
}
exports.showAll = showAllHelp;

function showCommandHelp(cmd, done) {
  Cmds.commands(function(err, commands) {
    if (err) return done(err);
    
    cmd = cmd.toLowerCase();
    var packageId = commands[cmd], exports;
    
    try {
      exports = require(packageId);
    } catch(e) {
      exports = null;
    }
        
    if (!exports || !exports.invoke) {
      CORE.println("Unknown command " + cmd);
      return done();
    }

    var opts = (exports.options || []).slice();
    opts = opts.concat(Cmds.STD_SWITCHES);
    opts = new optparse.OptionParser(opts);
    opts.banner = 'usage: seed ' + (exports.usage || cmd);
    CORE.println(opts.toString());
    if (exports.desc) CORE.println('\n' + exports.desc + '\n');
    return done();
  });
}
exports.showCommand = showCommandHelp;

exports.invoke = function(cmd, args, opts, done) {
  args = opts.parse(args); // get list of commands not switches
  if (args.length>0) return showCommandHelp(args[0], done);
  else return showAllHelp(done);
};

