// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir fixturesDir */

process.mixin(require('../common'));

var Seed = require('seed');
var Package = require('package');
var Repository = require('repository');

var seed = new Seed();// use custom one to control what's loaded
var basicPath = path.join(fixturesDir, 'basic');
var demoRepoPath = path.join(fixturesDir, 'demo_repository');

    
var repo = Repository.open(demoRepoPath);
seed.register(repo);

Package.open(basicPath, function(err, pkg) {
  if (err) throw err;
  
  seed.packageList(pkg, function(err, list) {
    if (err) throw err;
    sys.debug(sys.inspect(list));
    
    var expected = {
      "bar": ["3.2.1"],
      "foo": ["1.2.1", "2.0.0", "4.0.0"],
      "basic": ["0.1.0"],
      "foopkg": ["0.5.1"]
    };
    
    assert.deepEqual(list, expected);
    
    seed.preferredPackageList(pkg, function(err, list) {
      if (err) throw err;
      sys.debug(sys.inspect(list));
      
      var expected = {
        "bar": ["3.2.1"],
        "foo": ["4.0.0"],
        "basic": ["0.1.0"],
        "foopkg": ["0.5.1"]
      };
      assert.deepEqual(list, expected);

      // test opening a specific package
      seed.openPackage('foo', '1.2.1', pkg, function(err, fooPkg) {
        if (err) throw err;
        assert.ok(fooPkg);
        assert.equal(fooPkg.version(), '1.2.1');
        sys.debug(fooPkg.version());
      });
      
      // test opening any package
      seed.openPackage('foo', pkg, function(err, fooPkg) {
        if (err) throw err;
        assert.ok(fooPkg);
        assert.equal(fooPkg.version(), '4.0.0');
        sys.debug(fooPkg.version());
      });
      
      // test opening package with no curPackage
      seed.openPackage('foo', function(err, fooPkg) {
        if (err) throw err;
        assert.ok(fooPkg);
        assert.equal(fooPkg.version(), '2.0.0');
        sys.debug(fooPkg.version());
      });
      
    });
    
  });
});

