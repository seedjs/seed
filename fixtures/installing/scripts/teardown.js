#!/usr/bin/env node

var path = require('path'),
    fs = require('fs');
    
var out = path.normalize(path.join(__dirname, '..', 'TEARDOWN.out'));
fs.writeFileSync(out, 'teardown '+ process.cwd());
