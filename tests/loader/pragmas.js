// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global __dirname */

var loader = require('loader'),
    Co   = require('private/co');
var Ct = require('core_test:sync');

Ct.module('Loader#pragmas');

var desc = {
  moduleId: "foo"
};


Ct.test('processing file with no pragmas', function(t) {
  var text = [
    "var foo = bar;"
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  t.deepEqual(pragmas.imports, [], 'pragmas.imports');
  t.deepEqual(pragmas.exports, [], 'pragmas.exports');
  t.deepEqual(pragmas.autoExports, [], 'pragmas.autoExports');
  t.deepEqual(pragmas.autoImports, [], 'pragmas.autoImports');
});

Ct.test("use foo bar pragma", function(t) {
  var text = [
    '// This is an opening comment',
    '',
    '   "use foo bar";  // add it here',
    '',
    "var foo = bar;"
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  
  t.deepEqual(pragmas.imports, [], 'pragmas.imports');
  t.deepEqual(pragmas.exports, [], 'pragmas.exports');
  t.deepEqual(pragmas.autoExports, [], 'pragmas.autoExports');
  t.deepEqual(pragmas.autoImports, [], 'pragmas.autoImports');
  t.equal(pragmas.foo, 'bar', 'pragmas.foo');
});

Ct.test("export foo bar", function(t) {
  var text = [
    '/* This is an opening comment',
    ' another line */',
    '  "export foo bar";',
    '',
    "var foo = bar;"
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  
  t.deepEqual(pragmas.exports, ['foo', 'bar'], 'pragmas.exports');
  t.deepEqual(pragmas.autoExports, [{ exp: 'foo', symbol: 'foo' }, { exp: 'bar', symbol: 'bar' }], 'pragmas.autoExports');
});

Ct.test("export foo as bar", function(t) {
  var text = [
    '/* This is an opening comment',
    ' another line */',
    '  "export foo as bar";',
    '',
    "var foo = bar;"
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  
  t.deepEqual(pragmas.exports, ['bar'], 'pragmas.exports');
  t.deepEqual(pragmas.autoExports, [{ exp: 'bar', symbol: 'foo' }], 'pragmas.autoExports');
});

Ct.test("import foo bar", function(t) {
  var text = [
    '"import foo bar"; // comment after',
    '',
    "var foo = bar;"
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  
  t.deepEqual(pragmas.imports, ['foo', 'bar'], 'pragmas.imports');
  t.deepEqual(pragmas.autoImports, [{ moduleId: 'foo', symbol: '*' }, { moduleId: 'bar', symbol: '*' }], 'pragmas.autoImports');
});

Ct.test("import foo as bar", function(t) {
  var text = [
    '/* This is an opening comment',
    ' another line */',
    '  "import foo as bar";',
    '',
    "var foo = bar;"
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  
  t.deepEqual(pragmas.imports, ['foo'], 'pragmas.imports');
  t.deepEqual(pragmas.autoImports, [{ moduleId: 'foo', symbol: 'bar' }], 'pragmas.autoImports');
});

Ct.test("complex program", function(t) {
  var text = [
    '// This is an opening comment',
    '"import foo bar baz"  ; // basic imports',
    '  "import biff as bop";',
    "'export blarney';",
    '// "export boom shakalaka"; // should skip',
    '',
    '"use fib YES";',
    '"use strict";',
    '"use ploy false";',
    '"use quote \'QUOTE\'"',
    '  /* a comment */ "use pi 3.14156";  // ended ',
    '',
    '"require fip:bop";',
    "var foo = bar;",
    '',
    '"use another directive"'
  ].join("\n");
  
  var pragmas = loader.pragmas(text, desc);
  
  t.deepEqual(
    pragmas.imports, 
    ['foo', 'bar', 'baz', 'biff', 'fip:bop'], 
    'pragmas.imports');
  
  t.deepEqual(
    pragmas.exports, 
    ['blarney'], 
    'pragmas.exports');
  
  t.deepEqual(
    pragmas.autoExports, 
    [{ exp: 'blarney', symbol: 'blarney' }], 
    'pragmas.autoExports');
  
  t.deepEqual(
    pragmas.autoImports, 
    [ { moduleId: 'foo', symbol: '*' },
      { moduleId: 'bar', symbol: '*' },
      { moduleId: 'baz', symbol: '*' },
      { moduleId: 'biff', symbol: 'bop' },
      { moduleId: 'fip:bop' } ], 
    'pragmas.autoImports');

  t.equal(pragmas.fib, true, 'pragmas.fib');
  t.equal(pragmas.ploy, false, 'pragmas.ploy');
  t.equal(pragmas.pi, '3.14156', 'pragmas.pi');
  t.equal(pragmas.quote, "'QUOTE'", 'pragmas.quote');
  t.equal(pragmas.strict, undefined, 'pragmas.strict');
  t.equal(pragmas.another, undefined, 'pragmas.another');
});


Ct.run();
