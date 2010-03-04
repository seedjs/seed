// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co'),
    Cmds = require('commands'),
    optparse = require('optparse');

exports.summary = "Show this help message";

// cool trick...
var SPACES_ARRAY = [];
function spaces(cnt) {
  SPACES_ARRAY.length = cnt+1;
  return SPACES_ARRAY.join(' ');
}

function showAllHelp(done) {
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
      if (!exports || !exports.invoke) {
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
    Co.sys.puts(text.join("\n"));
    return done();
  });
}

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
      Co.sys.puts("Unknown command " + cmd);
      return done();
    }

    var opts = (exports.options || []).slice();
    opts = opts.concat(Cmds.STD_SWITCHES);
    opts = new optparse.OptionParser(opts);
    opts.banner = 'usage: seed ' + (exports.usage || cmd);
    Co.sys.puts(opts.toString());
    if (exports.desc) Co.sys.puts('\n' + exports.desc + '\n');
    return done();
  });
}

exports.invoke = function(cmd, args, opts, done) {
  args = opts.parse(args); // get list of commands not switches
  if (args.length>0) return showCommandHelp(args[0], done);
  else return showAllHelp(done);
};
