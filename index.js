// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  @file

  Bootstraps the seed package manager.  This should be the first module you
  actually load directly from the engine to get a seed environment going.

  This assume you have a very primitive require() method that can at least 
  load modules relatives to this one.
*/

var Seed     = require('./lib/seed').Seed,
    core     = require('./lib/private/core'),
    seed, configPath, SEED_ENV;


// find the seed config file.  It's at ~/.seeds/config.json
configPath = core.env.SEED_CONFIG || '~/.seeds/config.json';
configPath = core.path.normalize(configPath);

// create a default seed instance.  This is usually what people will work
// with.    
seed = module.exports = new Seed(configPath, core.env, core.args);
seed.addDefaultSources(); 

// if SEED_ENV is defined shift that in as well
SEED_ENV = core.env.SEED_ENV; 
if (SEED_ENV) seed.register(core.path.normalize(SEED_ENV));
