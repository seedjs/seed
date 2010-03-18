// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

var Co = require('./co');
var StringScanner = Co.extend({
  
  init: function(str) {
    this.str = str;
    this.loc = 0;
    this.length = 0;
  },
  
  _check: function(regex) {
    var sub, ret;
    if (this.eos()) return null; // at end of string
    sub = this.loc===0 ? this.str : this.str.slice(this.loc);
    ret = regex.exec(sub);
    return (ret && ret.index === 0) ? ret : null;
  },

  check: function(regex) {
    var ret, lim, idx;
    
    ret = this._check(regex);

    // remove previously saved items
    lim = this.length;
    for(idx=0;idx<lim;idx++) delete this[idx];

    // save matches
    if (ret) {
      lim = this.length = ret.length;
      for(idx=0;idx<lim;idx++) this[idx] = ret[idx];
    } 
    
    return ret ? ret[0] : null;
  },
  
  scan: function(regex) {
    var ret = this.check(regex);
    if (ret) this.loc+=ret.length;
    //Co.sys.debug('check('+regex+')='+(ret ? ret.length : 0)+' loc='+this.loc);
    return ret ;
  },
  
  skip: function(regex) {
    var ret = this._check(regex);
    if (ret) ret = ret[0];
    if (ret) this.loc += ret.length;
    //Co.sys.debug('skip('+regex+')='+(ret ? ret.length : 0)+' loc='+this.loc);
    return this;
  },
  
  eos: function() {
    return this.loc >= this.str.length;
  }
  
});

exports = module.exports = StringScanner;