// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var CORE = require('private/core');

exports.summary = "Set or view local config settings";
exports.usage = "config [add|remove] KEY [VALUE]";
exports.desc  = [
"Reads or updates settings from the local config file used to identify",
"repositories, remotes, etc."].join(' ');

// attempts to determine the type.  looks for certain keys until you pass 
// with quotes
function makeNative(str) {
  var ret = Number(str);
  if (!isNaN(ret)) return ret ; // number
  switch(str.toLowerCase()) {
    case 'true':
    case 'yes':
      return true;
      
    case 'false':
    case 'no':
      return false;

    default:
      if (str.match(/^([\"\']).*(\1)/)) str = str.slice(1,-1);
      return str;
  }
}

function isHash(obj) {
  return ('object' === typeof obj) && !Array.isArray(obj);
}

var isArray = CORE.isArray;

function pp(obj, indent) {
  var v, key;

  
  if (!indent) indent = '';

  if (obj===undefined) return;
  
  if (isHash(obj)) {
    CORE.println('');
    for(key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      v = obj[key];
      CORE.print(indent+key+': ');
      if (isHash(v) || isArray(v)) {
        pp(v, indent+'  ');
      } else {
        CORE.println(v);
      }
    }
  } else if (isArray(obj)) {
    if (obj.some(function(x) { return isHash(x) || isArray(x); })) {
      obj.forEach(function(x) { 
        pp(x, indent+'  ');
        CORE.println('');
      });
    } else {
      CORE.print(obj.join(', '));
    }
  } else {
    CORE.println(indent+obj);
  }
}

exports.invoke = function(cmd, args, opts, done) {
  var loader = require.loader,
      err, key, value, v, idx;

  args = opts.parse(args);
  key  = args.shift();
  if ((key === 'add') || (key === 'remove') || (key === 'delete')) {
    cmd = key;
    key = args.shift();
  }
  value = args.shift();
  if (value) value = makeNative(value);
  
  // add to array item
  if (cmd === 'add') {
    v = loader.get(key);
    if (v && !CORE.isArray(v)) {
      err=new Error(key+' is not an array property.  Delete first to reset.');
      return done(err);
    }
    v = v ? v.slice() : [];
    v.push(value);
    loader.set(key, v);
    loader.writeConfig();
    return done();
    
  // remove from array item
  } else if (cmd === 'remove') {
    v = loader.get(key);
    if (v && !CORE.isArray(v)) {
      err=new Error(key+' is not an array property.  Delete first to reset.');
      return done(err);
    }
    
    if (!v || v.indexOf(value)<0) return done(); // nothing to do
    
    idx = v.indexOf(value);
    v = v.slice(0,idx).concat(v.slice(idx+1));
    loader.set(key, v);
    loader.writeConfig();
    return done();

  } else if (cmd === 'delete') {
    loader.set(key, undefined);
    loader.writeConfig();
    return done();

  // show all configs
  } if (key === undefined) {
    var configs = loader.getAll();
    pp(configs);
    CORE.println('');
    return done();

  // read config
  } else if (value === undefined) {
    pp(loader.get(key));
    CORE.println('');
    return done();

  // replace config
  } else {
    loader.set(key, value);
    loader.writeConfig();
    return done();
  }
};

