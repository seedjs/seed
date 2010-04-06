// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Ct   = require('core_test:sync'),
    help = require('../helpers'),
    seed = require('../../source');

var SOURCE_PATH = help.path.join(help.FIXTURES_ROOT, 'test-source');

Ct.module('seed.Source#get');
Ct.setup(function(t) {
  t.source = new seed.Source(SOURCE_PATH);
});

Ct.teardown(function(t) {
  delete t.pkg;
});

Ct.test("should find options in the config", function(t) {
  t.equal(t.source.get('option'), 'hasit');
  t.equal(t.source.get('not-an-options'), null);
});

Ct.test('should normalize options', function(t) {
  t.source.normalize = function() {
    return "NORMALIZE";
  };
  
  t.equal(t.source.get('option'), 'NORMALIZE');
});



// ..........................................................
// SET
// 

Ct.module('seed.Source#set/writeConfig');
Ct.setup(function(t) {
  t.path   =  help.stage('test-source');
  t.source = new seed.Source(t.path);
});

Ct.teardown(function(t) {
  help.unstage('test-source');
  delete t.source;
  delete t.path;
});

Ct.test("round-tripping edits", function(t) {
  t.source.set('fiddle-sticks', 'biggle');
  t.source.writeConfig();
  
  var source2 = new seed.Source(t.path);
  t.equal(source2.get('fiddle-sticks'), 'biggle');
});



Ct.run();
