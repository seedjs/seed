// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals __filename */

var Co = require('./co'),
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

    var repoPaths = seedPackage.info('seed');
    if (repoPaths) repoPaths = repoPaths.repositories;
    if (!repoPaths) repoPaths = [];
    
    Co.each(repoPaths, function(path, done) {
      Repository.open(path, function(err, repo) {
        if (err) return done(err);
        seed.register(repo, done);
      });      
    })(done);
  });
});

