#!/usr/bin/env node

// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license
// ==========================================================================
/*globals __dirname  process */

// Runs once to install seed. 
var Co = require('../lib/co');

var SEED_DIR = Co.path.normalize(Co.path.join(__dirname, '..')),
    NODE_LIBRARIES = Co.path.join(process.env.HOME, '.node_libraries'),
    SEED_REPO_BIN = Co.path.join(process.env.HOME, '.seeds', 'bin');

var O_RWX = 511; //0777

// Step 1: Configure and build native extensions
Co.chain(function(done) {
  var cmd = 'cd '+SEED_DIR+'; node-waf configure build';
  Co.sys.puts(cmd);
  Co.sys.exec(cmd, function(err, str) {
    if (err) return done(err);
    Co.sys.puts(str);
    return done();
  });

// Step 2: Copy or symlink seed into node_libraries.  If env.MODE = 'dev'
// link only  
}, function(done) {

  Co.fs.mkdir_p(NODE_LIBRARIES, O_RWX, function(err) {
    if (err) throw err;

    var path = Co.path.join(NODE_LIBRARIES,'seed'), cmd;

    var mode = (process.env.MODE || 'dev').toLowerCase();
    if (mode === 'dev') {
      cmd = 'ln -s ' + SEED_DIR + ' ' + path;
    } else {
      cmd = 'cp -r ' + SEED_DIR + ' ' + path;
    }

    Co.path.exists(path, function(err, exists) {
      if (exists && !process.env.FORCE) {
        Co.sys.puts('WARNING: ~/.node_libraries/seed already exists');
        return done();
        
      } else {
        Co.sys.exec(cmd, Co.err(done));
      }
    });

  });

// Step 3: Copy seed/bin/* to .seeds/bin dir
}, function(done) {
  Co.fs.mkdir_p(SEED_REPO_BIN, O_RWX, function(err) {
    if (err) throw err;
    
    var SRC_DIR = Co.path.join(SEED_DIR, 'bin');
    Co.fs.readdir_p(SRC_DIR, function(err, bins) {
      if (err) return done(err);
      if (!bins) bins = [];
      
      Co.each(bins, function(filename, done) {
        var src = Co.path.join(SRC_DIR, filename);
        var dst = Co.path.join(SEED_REPO_BIN, filename);
        var cmd = 'ln -s '+src+' '+dst;

        Co.path.exists(dst, function(err, exists) {
          if (exists && !process.env.FORCE) {
            Co.sys.puts('~/.seed/bin/'+filename+' already exists');
            return done(); // skip
          } else {
            Co.sys.puts(cmd);
            Co.sys.exec(cmd, Co.err(done));
          }
        });
        
      })(done);
    });

  });

  
})(function(err) {
  if (err) Co.sys.puts("Failed: " + err);
  else Co.sys.puts("Done");
});
