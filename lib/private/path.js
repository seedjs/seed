// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see license.txt)
// ==========================================================================
/*globals process */

var core = require('../private/core');
var PATH = require('./platform').path;
var path = exports;

path.join = PATH.join;
path.dirname = PATH.dirname;
path.basename = PATH.basename;
path.extname = PATH.extname;

path.normalize = function(path) {
  if (path==='.' || path==='..' || path.match(/^\.\.?[\/\\]/)) {
    path = PATH.join(process.cwd(), path);  // expand relative
    
  } else if (path==='~' || path.match(/^~[\/\\]/)) { // expand home
    path = PATH.join(process.env.HOME, path.slice(1));
  }
  
  // if last part of path is '/' strip b/c we want to refer to dir
  if (path[path.length-1]==='/') path = path.slice(0,-1);
  return PATH.normalize(path);
};

path.SEPARATOR = '/';
