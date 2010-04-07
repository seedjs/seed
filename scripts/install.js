#!/usr/bin/env node

// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license
// ==========================================================================
/*globals __dirname  process */

// Runs once to install seed. 
var CORE = require('../lib/private/core');

var SEED_DIR = CORE.path.normalize(CORE.path.join(__dirname, '..')),
    NODE_LIBRARIES = CORE.path.join(process.env.HOME, '.node_libraries'),
    SEED_REPO_BIN = CORE.path.join(process.env.HOME, '.seeds', 'bin');

var O_RWX = 511; //0777

// Step 1: Configure and build native extensions
CORE.iter.chain(function(done) {
  var cmd = 'cd '+SEED_DIR+'; node-waf configure build';
  CORE.println(cmd);
  CORE.fs.exec(cmd, function(err, str) {
    if (err) return done(err);
    CORE.println(str);
    return done();
  });

// Step 2: Copy or symlink seed into node_libraries.  If env.MODE = 'dev'
// link only  
}, function(done) {

  CORE.fs.mkdir_p(NODE_LIBRARIES, O_RWX, function(err) {
    if (err) throw err;

    var path = CORE.path.join(NODE_LIBRARIES,'seed'), cmd;

    var mode = (process.env.MODE || 'dev').toLowerCase();
    if (mode === 'dev') {
      cmd = 'ln -s ' + SEED_DIR + ' ' + path;
    } else {
      cmd = 'cp -r ' + SEED_DIR + ' ' + path;
    }

    CORE.fs.exists(path, function(err, exists) {
      if (exists && !process.env.FORCE) {
        CORE.println('WARNING: ~/.node_libraries/seed already exists');
        return done();
        
      } else {
        CORE.fs.exec(cmd, CORE.err(done));
      }
    });

  });

// Step 3: Copy seed/bin/* to .seeds/bin dir
}, function(done) {
  CORE.fs.mkdir_p(SEED_REPO_BIN, O_RWX, function(err) {
    if (err) throw err;
    
    var SRC_DIR = CORE.path.join(SEED_DIR, 'bin');
    CORE.fs.readdir_p(SRC_DIR, function(err, bins) {
      if (err) return done(err);
      if (!bins) bins = [];
      
      CORE.iter.each(bins, function(filename, done) {
        var src = CORE.path.join(SRC_DIR, filename);
        var dst = CORE.path.join(SEED_REPO_BIN, filename);
        var cmd = 'ln -s '+src+' '+dst;

        CORE.fs.exists(dst, function(err, exists) {
          if (exists && !process.env.FORCE) {
            CORE.println(dst+' already exists');
            return done(); // skip
          } else {
            CORE.println(cmd);
            CORE.fs.exec(cmd, CORE.err(done));
          }
        });
        
      })(done);
    });

  });

  
})(function(err) {
  if (err) CORE.println("Failed: " + err);
  else CORE.println("Done.  If you haven't already, add "+SEED_REPO_BIN+' to your PATH to use seed commands');
});
