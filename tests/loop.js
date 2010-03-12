// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir __filename */

process.mixin(require('./common'));

var loop = require('private/loop');

var Co = require('co');

Co.fs.stat(__filename, function(err, stat) {
  Co.sys.puts("stat1");

  var looped = false;
  var unlooped = false;
  var timer ;
  
  function fire() {
    unlooped = true;
    if (looped) {
      looped = false;
      loop.unloop();
    }
    
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }
  
  Co.fs.stat(__filename, function(err, stat2) {
    Co.sys.puts("stat2");
    fire();
  });
  
  timer = setTimeout(function() {
    Co.sys.puts('unloop');
    fire();
  });

  if (!unlooped) {
    looped = true;
    loop.loop(); // wait
  }
  
});

// var i = 0;
// 
// function sched(again) {
//   var iter = i++;
//   setTimeout(function() {
//     if (again) sched(false);
//     sys.puts("unloop "+iter);
//     loop.unloop();
//   }, 1000);
// 
//   sys.puts("loop "+iter);
//   loop.loop();
// }
// 
// sched(true);