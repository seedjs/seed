// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw "Can only load from within seed";

var core = require('private/core');
var seed = require.seed;
var semver = require('semver');

exports.summary = "Set or view local config settings";
exports.usage = "config KEY [VALUE]";
exports.desc  = [
"Reads or updates settings from the local config file used to identify",
"repositories, remotes, etc."].join(' ');

function showAllConfigs(sources, done) {
  var configs = {};
  
  function iter(hash, base) {  
    for(var key in hash) {
      if (!hash.hasOwnProperty(key)) continue;
      var val = hash[key];

      if (base) key = base + '.' + key;
      if (key === 'seed.commands') continue; 
      if (('object' === typeof val) && !Array.isArray(val)) iter(val, key);
      else if (val !== undefined) configs[key] = core.inspect(val);
    }
  }

  sources.forEach(function(src) { 
    if (src === seed.seedPackage) iter({ seed: src.info().seed }, null);
    else iter(src.info(), null); 
  });
  
  for(var key in configs) {
    if (!configs.hasOwnProperty(key)) continue;
    core.println(key + ': ' + configs[key]);
  }

  done();
}

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

// returns { root: hash_to_write, key: key_to_write, prop: remaining prop, target: hash to write to }
// expects path to contain at least one '.'
function writeableConfig(source, path) {
  var key, ret = {}, working, next;
  
  path = path.split('.');
  ret.prop = path.pop();
  key = ret.key = path.shift();
  
  working = source.info(key);
  working = isHash(working) ? core.mixin({}, working) : {};
  ret.root = working;
  
  while(key = path.shift()) {
    next = working[key];
    next = isHash(next) ? core.mixin({}, next) : {};
    working[key] = next;
    working = next;
  }
  ret.target = working;
  return ret ;
}

exports.invoke = function(cmd, args, opts, done) {
  var sources = require.seed.sources, key, value, src, ret, info, loc;
  args = opts.parse(args);
  key  = args.shift();
  if ((key === 'add') || (key === 'remove')) {
    cmd = key;
    key = args.shift();
  }
  value = args.shift();

  // add to array item
  if (cmd === 'add') {
    done();
    
  // remove from array item
  } else if (cmd === 'remove') {
    done();

  // show all configs
  } if (key === undefined) {
    showAllConfigs(sources, done);

  // read config
  } else if (value === undefined) {
    if (key.indexOf('.')>=0) {
      
    } else {
      loc = sources.length;
      while((ret===undefined) && (--loc>=0)) {
        src = sources[loc];
        ret = src.info(key);
      }
      core.println(key + ': '+core.inspect(ret));
    }
    done();

  // replace config
  } else {
    core.debug(core.inspect(sources.map(function(src) { return src.config.path; })));
    
    src = sources[sources.length-1];
    if (key.indexOf('.')>=0) {
      info = writeableConfig(src, key);
      info.target[info.prop] = makeNative(value);
      src.info(info.key, info.root);
      src.config.write(function(err) { return done(err); });

    } else {
      src.info(key, makeNative(value));
      core.println(key + ': '+core.inspect(src.info(key)));
      core.debug(src.config.path);
      src.write(function(err) { return done(err); });
    }
  }
};