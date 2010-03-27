// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals __filename process */

var Co = require('./private/co'),
    Seed = require('./seed'),
    Package = require('./package'),
    Repository = require('./repository'),
    seed, path, seedPackage;
    
// create a default seed.  This is usually what people will work with
seed = module.exports = new Seed('default');
seed.Seed = Seed; // export class so it's easy to create your own

// bootstrap in the current seed package and any default repositories
// this has to be done sync before the require returns
path = Co.path.normalize(Co.path.join(Co.path.dirname(__filename), '..'));

Co.wait(function(done) {
  Package.open(path, function(err, seedPackage) {
    if (err) return done(err);
    seed.register(seedPackage); // always fallback to ourself
    seed.seedPackage = seedPackage ;

    var repositories = seedPackage.info('seed:sources');
    if (!repositories) repositories = {};
    
    // rewrite into array of hashes so we can iterate over them
    var paths = [] ;
    for(var key in repositories) {
      if (!repositories.hasOwnProperty(key)) continue;
      paths.push({ domain: key, path: repositories[key] });
    }
    
    paths = paths.reverse(); // first named should be first searched...
    
    Co.each(paths, function(info, done) {
      Repository.open(info.path, function(err, repo) {
        if (err) return done(err);
        repo.domain = info.domain;
        seed.register(repo, done);
      });
      
    // all repositories have been added.  If SEED_ENV is defined, unshift
    // that path in as well      
    })(function(err) {
      if (err) return done(err);

      var SEED_ENV = process.env.SEED_ENV;
      if (SEED_ENV && SEED_ENV.length>0) {
        seed.register(Co.path.normalize(SEED_ENV), done);
      } 
      else return done();
      
    });
  });
});

// export the native LOOP api so that other packages can use it
var LOOP = require('./private/loop');
seed.loop = LOOP.loop;
seed.unloop = LOOP.unloop;

