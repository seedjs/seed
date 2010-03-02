#!/usr/bin/env node

var path = require('path'),
    fs = require('fs');
    
var out = path.normalize(path.join(__dirname, '..', 'SETUP.out'));
fs.writeFileSync(out, 'setup '+process.cwd());
