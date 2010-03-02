// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

/**
  @file

  Bootstraps the seed package manager for node.  Place the seed directory 
  into your .node_libraries folder.  When you require('seed') you will get
  this file back [which really just forwards to the package index].
  
*/

exports = module.exports = require('./lib/index');
