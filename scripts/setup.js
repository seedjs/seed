#!/usr/bin/env node

var Co = require('../lib/co');

var SEED_DIR = Co.path.normalize(Co.path.join(__dirname, '..'));
var NODE_LIBRARIES = Co.path.join(process.env.HOME, '.node_libraries');
var SEED_REPO_BIN = Co.path.join(process.env.HOME, '.seeds', 'bin');

Co.fs.mkdir_p(NODE_LIBRARIES, 0777, function(err) {
  if (err) throw err;
  
  var path = Co.path.join(NODE_LIBRARIES,'seed');
  var cmd = 'ln -s ' + SEED_DIR + ' ' + path;
  Co.path.exists(path, function(err, exists) {
    if (exists) Co.sys.puts('~/.node_libraries/seed already exists');
    else {
      Co.sys.exec(cmd, function(err) {
        if (err) Co.sys.puts(cmd + ' FAILED!');
        else Co.sys.puts(cmd + ' SUCCESS');
      });
    }
  });
  
});

Co.fs.mkdir_p(SEED_REPO_BIN, 0777, function(err) {
  if (err) throw err;
  var src = Co.path.join(SEED_DIR, 'bin','seed');
  var dst = Co.path.join(SEED_REPO_BIN, 'seed');

  var cmd = 'ln -s ' +src + ' ' +dst;
  Co.path.exists(dst, function(err, exists) {
    if (exists) Co.sys.puts('~/.seeds/bin/seed already exists');
    else {
      Co.sys.puts(cmd);
      Co.sys.exec(cmd, function(err) {
        if (err) Co.sys.puts(cmd + ' FAILED!');
        else Co.sys.puts(cmd + ' SUCCESS');
      });
    }
  });
});


