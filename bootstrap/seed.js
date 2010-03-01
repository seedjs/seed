/*globals process require __filename */

/**
  @file
  
  This bootstrap module will actually locate the local seed package and 
  bootstrap it, allowing the rest of the seed library to be used like normal.
  
*/

var path = require('path'),
    sys  = require('sys'),
    fs   = require('fs'),
    SEED_PATH, seed ;

// if this file is still inside the "bootstrap" directory then it has not 
// been installed yet and we need to look locally.
if (__filename.match(/seed.bootstrap.seed\.js$/)) {
  SEED_PATH = path.normalize(path.join(__filename, '..', '..'));
} else {
  SEED_PATH = path.normalize(path.join(process.env.HOME, '.seeds'));
}

SEED_PATH = path.join(SEED_PATH, 'packages', 'seed', 'lib', 'index');
module.exports = require(SEED_PATH); // load seed and map in exports

