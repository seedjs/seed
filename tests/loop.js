// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*global process path sys assert libDir __filename */

var Ct = require('core_test:sync');
var loop = require('private/loop');
var Co = require('private/co');

Co.fs.stat(__filename, function(err, stat) {
  Co.println("stat1");

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
    Co.println("stat2");
    fire();
  });
  
  timer = setTimeout(function() {
    Co.println('unloop');
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