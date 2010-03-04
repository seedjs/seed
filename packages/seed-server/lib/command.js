// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================


var Co = require('seed:co');

exports.usage = 'server';
exports.summary = "Starts a new seed server";
exports.options = [
  ['-p', '--port PORT', 'Port to listen on. Defaults to 4050'],
  ['-h', '--host HOST', 'Hostname to listen on.  Defaults to 0.0.0.0'],
  ['-r', '--root ROOT', 'Root directory to serve from. Default to ~/.seeds/server']
];
  
exports.desc = [
'Starts a seed server on the local machine'].join('');

exports.invoke = function(cmd, args, opts, done) {
  var port = '4050';
  var host = '0.0.0.0';
  var root = '~/.seeds/server';
  
  opts.on('port', function(k,v) { port =v; });
  opts.on('host', function(k,v) { 
    var idx = v.indexOf(':');
    if (idx>=0) {
      port = v.slice(idx+1);
      v = v.slice(0, idx);
    }

    if (v && v.length>0) host = v;
  });
  
  opts.on('root', function(k,v) { root =v; });
  args = opts.parse(args);
  
  root = Co.path.normalize(root);
  
  Co.sys.puts("Seed Server v" + module.pkg.info('version'));
  Co.sys.puts("Listening on " + host + ":" + port);
  Co.sys.puts("Rooted at " + root);

  return done();
};
