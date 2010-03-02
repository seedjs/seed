// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir fixturesDir */

process.mixin(require('../common'));

var Seed = require('seed');
var Repository = require('repository');

var seed = new Seed();// use custom one to control what's loaded

var demoRepoPath = path.join(fixturesDir, 'demo_repository');

var repo = Repository.open(demoRepoPath);
seed.register(require('index').sources[0]); // add seedPackage
seed.register(repo);

seed.require('seed:commands').collectPluginInfo(function(err, info) {
  if (err) {
    sys.puts(err);
    throw err;
  }
  
  sys.puts(sys.inspect(info));
});


seed.require('seed:commands').commands(function(err, info) {
  if (err) {
    sys.puts(err);
    throw err;
  }
  
  sys.puts(sys.inspect(info));
});
