// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir */

process.mixin(require('../common'));

var Package = require('package');
var pkgDir = path.dirname(libDir);

var pkg = new Package(pkgDir);

sys.puts(pkg.pathForModule('package'));
sys.puts(pkg.pathForModule('foo'));
