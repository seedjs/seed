// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.sandbox) throw new Error("Can only load from within seed");

var CORE     = require('private/core'),
    HTTP     = CORE.http,
    URL      = CORE.url,
    QUERYSTRING = CORE.querystring,
    SEMVER   = require('tiki').semver;

var Config;

/**
  Describes a remote service for fetching seed packages.  The default version
  talks to seed-server installs but you can create your own interface for 
  any service you want.
*/

// default class
var Remote = CORE.extend(Object);
exports.Remote = Remote;

CORE.mixin(Remote.prototype, {

  init: function(url, token) {
    this.url = url;
    this.parsedUrl = URL.parse(this.url, true);
    this.token = token;
    
    var parts = URL.parse(this.url, true);
    this.port = parts.port || 80;
    this.hostname = parts.hostname;
    this.root = parts.pathname;
    this.query = parts.query;
  },
  
  request: function(method, subpart, query2, headers, done) {
    
    if ('function' === typeof headers) {
      done = headers;
      headers = undefined;
    }

    var body;
    if (query2.body) {
      body = query2.body;
      delete query2.body;
    }
    
    var client = HTTP.createClient(this.port, this.hostname);
    var path = this.root + '/'+subpart;
    var isJson;

    var query = this.query ? CORE.mixin({}, this.query) : {};
    if (query2) CORE.mixin(query, query2);
    query = QUERYSTRING.stringify(query);
    if (query) path = path + '?'+query;

    // Always must include a Host header 
    if (!headers) headers = [];
    
    var hostHeader = this.hostname;
    if (Number(this.port) !== 80) hostHeader = hostHeader+':'+this.port;
    headers.push(['Host', hostHeader]);
    
    // write body if needed
    if (body) {
      body = JSON.stringify(body);
      headers.push(['Content-Type', 'application/json']);
      headers.push(['Content-Length', body.length]);
    } else {
      //headers.push(['Content-Length', 0]);
    }
    
    var req = client.request(method, path, headers || {});
    req.addListener('response', function(response) {
      
      response.setBodyEncoding("utf8");
      var data = [];
      
      isJson = response.headers['content-type'] === 'application/json';
      response.addListener("data", function(chunk) { 
        data.push(chunk); 
      });
     
      response.addListener("end", function() {
        data = data.join('');
        if (isJson) { 
          data = JSON.parse(data);
        }
        
        done(null, response.statusCode, data, response.headers);
      });
    });
    
    client.addListener('error', function() {
      done('Connection error');
    });
    
    if (body) req.write(body, 'utf8');
    
    req.end();
  },
  
  /**
    Downloads an asset from the HTTP server to the named target location.
    Creating any directories in the process.  Invokes done when complete
  */
  download: function(path, url, headers, done) {
    
    // cleanup after a download if we failed
    var cleanup = function(path, fd) {
      CORE.fs.close(fd, function(err) {
        CORE.fs.rm(path, CORE.noop);
      });
    };

    if ('function' === typeof headers) {
      done = headers;
      headers = undefined;
    }

    var remote = this;
    
    // first make sure we have a directory to write to and then open a 
    // file for writing
    CORE.iter.chain(function(done) {
      CORE.fs.mkdir_p(CORE.path.dirname(path), 511, function(err) {
        if (err) return done(err);
        CORE.fs.open(path, 'w+' , 511, done);
      });
      
    // next, open a connection to the server and download...
    }, function(fd, done) {
      
      // use a queue to control writing to disk.  This allows us to stream
      // receiving a file.
      
      var level = 1;
      function endWrite() {
        if (--level <= 0) {
          CORE.verbose('download complete');
          return done();
        }
      }
      
      var queue = [];
      var writing = false;

      function writeChunk() {
        if (writing) return;
        var chunk = queue.shift();
        if (chunk !== undefined) {
          writing = true;
          CORE.fs.write(fd, chunk, null, 'binary', function(err) {
            if (err) return done(err);
            writing = false;
            endWrite();
            writeChunk();
          });
        }
      }
      
      if (!headers) headers = [];
      var hostHeader = remote.hostname;
      if (Number(remote.port) !== 80) hostHeader = hostHeader+':'+remote.port;
      headers.push(['Host', hostHeader]);

      var client = HTTP.createClient(remote.port, remote.hostname);
      var req = client.request('GET', url, headers || {});

      req.addListener('response', function(response) {
        if ((response.statusCode >= 200) && (response.statusCode<300)) {
          response.setBodyEncoding("binary");

          response.addListener("data", function(chunk) {
            level++;
            queue.push(chunk);
            writeChunk();
          });

          response.addListener("end", function() {
            endWrite();
          });
        } else cleanup(path, fd);
      });

      client.addListener('error', function() {
        cleanup(path, fd);
        done('Connection error');
      });

      req.end();

    })(done);
  },
  
  
  upload: function(method, url, path, headers, done) {

    if ('function' === typeof headers) {
      done = headers;
      headers = undefined;
    }

    var remote = this;
    
    // open file for reading
    CORE.fs.stat(path, function(err, stat) {
      if (err) return done(err);
      var len = stat.size;
      CORE.verbose("Uploading " + len + " bytes");
      
      CORE.fs.open(path, 'r', 0, function(err, fd) {
        if (err) return done(err);

        var client = HTTP.createClient(remote.port, remote.hostname);
        
        if (!headers) headers = [];
        //headers.push(['Transfer-Encoding', 'chunked']);
        headers.push(['Content-Length', len]);

        var hostHeader = remote.hostname;
        if (Number(remote.port) !== 80) hostHeader = hostHeader+':'+remote.port;
        headers.push(['Host', hostHeader]);
        
        var req = client.request(method, url, headers);
        req.addListener('response', function(response) {
          var body = [];
          
          response.addListener('data', function(chunk) {
            body.push(chunk);
          });
          
          response.addListener('end', function() {
            if ((response.statusCode < 200) || (response.statusCode>=300)) {
              var err = new Error(body.join(''));
              err.status = response.statusCode;
              return done(err);
            } else return done(); // success
          });
        });

        var reqError = null;
        var doneReading = false;

        client.addListener('error', function() {
          reqError = 'Connection error';
          if (doneReading) done('Connection error');
        });

        var pos = 0;

        var data = CORE.fs.readFile(path, 'binary');
        req.write(data, 'binary');
        req.end();

        // var readNext = function(done) {
        //   if (reqError) return done(reqError);
        //   if (pos>=len) return done();
        // 
        //   CORE.fs.read(fd, 4096, pos, 'binary', function(err, data, byteCnt) {
        //     if (err) return done(err); // failed!
        //     req.write(data, 'binary'); // write partial
        //     pos += byteCnt;
        //     readNext(done);
        //   });
        // };
        // 
        // readNext(function(err) {
        //   doneReading = true;
        //   
        //   CORE.fs.close(fd);
        //   req.close();
        //   
        //   if (err) return done(err);
        // });

      });
      
    });
  },
  
  /**
    Gets a tokens config file on disk.  Stored per user.
  */
  tokens: function() {
    if (this._tokens) return this._tokens;
    var path = CORE.path.normalize('~/.seeds/tokens.json');
    this._tokens = CORE.fs.exists(path) ? CORE.fs.readJSON(path) : {};
    return this._tokens;
  },
  
  writeTokens: function(done) {
    if (!this._tokens) this._tokens = {};
    var path = CORE.path.normalize('~/.seeds/tokens.json');
    var err;
    
    try {
      CORE.fs.mkdir_p(CORE.path.dirname(path));
      CORE.fs.writeJSON(path, this._tokens);
    } catch(e) {
      err = e;
    }
    
    if (err) return done(err);
    return done();
  },
  
  /** 
    Returns a new tmp path
  */
  tmproot: function() {
    return CORE.path.join(CORE.TMPDIR, CORE.uuid());
  },
  
  /**
    Fetch a list of all packages matching the passed options.  Options 
    include:
    
    - name: one or more names of packages
    - version: version of package (only if name is a string) 
    - dependencies: true if we should get dependencies also
  */
  list: function(opts, done) {
    this.request('GET', 'packages', opts, function(err, status, data) {
      if (err) return done(err);
      if (status === 200) return done(null, data.records);
      else done("Server error: "+status.toString()+' '+data);
    });
  },
  
  /**
    Fetch an individual package.  Invoke done with a path to the package so 
    that it can be installed into a local repository.  The package should be 
    unzipped so you can simply copy it over.
    
    @param packageInfo {Object}
      A package info object returned by a previous call to the list() method.
      
    @param done {Function}
      Callback invoked when fetch is complete or errors out.

    @returns {void}    
  */
  fetch: function(packageInfo, done) {
    var path = this.tmproot();
    var filepath = path + '.zip';
    
    var url = packageInfo['link-asset'];
    CORE.verbose('fetching ' + url); 
    this.download(filepath, url, function(err){
      if (err) return done(err);
      CORE.verbose('unzipping ' + filepath);
      CORE.fs.exec('unzip ' +filepath+' -d '+path, function(err) {
        if (err) return done(err);
        CORE.fs.readdir_p(path, function(err, dirs) {
          if (err) return done(err);
          CORE.fs.rm_r(filepath, CORE.noop); // cleanup zipfile
          if (!dirs || (dirs.length===0)) return done(null, null);
          return done(null, CORE.path.join(path, dirs[0]));
        });
      });
    }); 
  },
  
  /**
    Invoked by the installer when we are done installing the path you 
    provided.  Use this to cleanup tmpfiles
  */
  cleanup: function(path, done) {
    CORE.verbose('cleaning up tmp at ' +path);
    CORE.fs.rm_r(CORE.path.dirname(path), CORE.err(done));
  },
  
  /**
    Prompts for username/password then obtains a token.  Returns error and
    token if obtained
  */
  login: function(usernames, done) {   
    var remote = this;
    
    // collect username
    CORE.iter.chain(function(done) {
      CORE.println("Login to "+remote.url);
      
      if (usernames && usernames.length>0) return done(usernames[0]);

      CORE.println("Username:");
      CORE.prompt(done);

    // collect password
    }, function(username, done) {
      CORE.println("Password:");
      CORE.prompt(function(err, password) {
        return done(err, username, password);
      });
      
    // go get a token from remote...
    }, function(username, password, done) {
      CORE.prompt.done();
      username = username.slice(0,0-1); // cut newline
      password = password.slice(0,0-1);
      
      CORE.verbose("Obtaining login token for "+username+" from "+remote.url);
      
      var digest = require('private/md5').b64(password);
      var opts = { username: username, digest: digest };
      opts.body = { "user": username };
      remote.request('POST', 'tokens', opts, function(err, status, data) {
        if (!err && (status<200) && (status>=300)) err = status;
        if (err) return done(err);

        // write token into local storage for future use
        var tokenId = data.id;       
        if (!tokenId) {
          return done("Server did not return token (data="+CORE.inspect(data)+")");
        }
        
        var tokens = remote.tokens();
        var token  = tokens[remote.url];
        
        token = token ? CORE.mixin({}, token) : {};
        token[username] = tokenId;
        tokens[remote.url] = token;
        remote.writeTokens(function(err) {
          if (err) return done(err);
          return done(null, tokenId);
        });
        
      });
    })(done);
  },
  
  /**
    Invoked by seed to logout of remote.  This destroys the token and forgets
    it locally
  */
  logout: function(usernames, done) {
    var remote = this;
    
    if (!usernames || (usernames.length===0)) usernames = null;
    if (!usernames) {
      CORE.println("Removing all tokens for "+remote.url);
    } else {
      CORE.println("Removing tokens for "+usernames.join(',')+" on "+remote.url);
    }
    
    var tokens = remote.tokens();
    var active = tokens[remote.url];
    if (!active || (Object.keys(active).length===0)) {
      CORE.verbose("  No login tokens found");
      return done(); // nothing to do
    }
      
    active = CORE.mixin({}, active);

    if (!usernames) usernames = Object.keys(active);
    CORE.iter.each(usernames, function(username, done) {
      var token = active[username];
      if (token) {
        delete active[username];
        CORE.verbose('  Deleting '+username+' token '+token);
        remote.request("DELETE", 'tokens/'+token, {}, function(err, status){
          if (!err && (status<200) && (status>=300)) err = status;
          if (err) return done(err);
          done();
        });
      } else CORE.verbose('  No login token for '+username);
      
    })(function(err) {
      if (err) return done(err);
      tokens[remote.url] = active;
      remote.writeTokens(CORE.err(done));
    });
  },
  
  /**
    Invoked by seed to create a new account on the remote.  This should 
    also log you in.
  */
  signup: function(done) {
    
    // need to collect some information...
    var username;
    var password;
    var email;
    var name;
    var remote = this;
    
    // get username
    CORE.iter.chain(function(done) {
      CORE.println("Create new account for " + remote.url);
      CORE.println("Username:");
      CORE.prompt(function(err, value) {
        if (err) return done(err);
        username = value.slice(0,-1);
        if (username.length===0) return done("username cannot be empty");
        return done();
      });
    
    // read name
    }, function(done) {
      CORE.println("Real name:");
      CORE.prompt(function(err, value) {
        if (err) return done(err);
        name = value.slice(0,-1);
        if (name.length===0) return done("Name cannot be empty");
        return done();
      });

    // get email
    }, function(done) {
      CORE.println("Email:");
      CORE.prompt(function(err, value) {
        if (err) return done(err);
        email = value.slice(0,-1);
        if ((email.length===0) || (email.indexOf('@')<0)) {
          return done("Must provide valid email");
        }
        
        return done();
      });
      
    // get password
    }, function(done) {
      CORE.println("Password:");
      CORE.prompt(function(err, value) {
        if (err) return done(err);
        password = value.slice(0,-1);
        if (password.length===0) return done("password cannot be empty");
        return done();
      });
      
    // create account
    }, function(done) {
      CORE.prompt.done(); // no more data required
      CORE.println("Creating account...");

      var body = { 
        "id": username, 
        "password": password, 
        "name": name,
        "email": email 
      };
      var par = { body: body };
      remote.request('POST', 'users', par, function(err, status, data, hdrs) {
        if (err || (status<200) || (status>300)) return done(err||status);
        var tokenId = hdrs['x-seed-token'];
        if (!tokenId) {
          return done("Signup complete but could not obtain token.  Try to login again with seed remote login");
        }
        
        // write token into local storage for future use
        var tokens = remote.tokens();
        var token  = tokens[remote.url];
        token = token ? CORE.mixin({}, token) : {};
        token[username] = tokenId;
        tokens[remote.url] = token;
        
        remote.writeTokens(function(err) {
          if (err) return done(err);
          return done(null, tokenId);
        });
        
      });
      
    })(done);
  },
  
  /**
    Invoked by seed to push a package to a remote repository
  */
  push: function(pkg, username, done) {
    var remote= this;

    (function(done) {
      var tokens = remote.tokens();
      var token  = tokens[remote.url];
      if (token) {
        if (!username) {
          for(username in token) {
            if (!token.hasOwnProperty(username)) continue;
            break;
          }
        }  
        token = token[username];
      }
        
      // not found, login...
      if (!token) remote.login(null, done);
      else return done(null, token);
      
    })(function(err, token) {
      if (!err && !token) err = "Could not obtain token for remote";
      if (err) return done(err);
      CORE.verbose("pushing with token " + token);
      return remote._push(pkg, token, done);
    });
  },
    
  _push: function(pkg, token, done) {

    var rootdir  = this.tmproot();
    var filename = pkg.get('name')+'-'+SEMVER.normalize(pkg.get('version'));
    var dstroot  = CORE.path.join(rootdir, filename);
    var zipfile  = dstroot + '.zip';
    var remote   = this;
    
    CORE.fs.mkdir_p(rootdir, 511, function(err) {
      if (err) return done(err);
      
      // collect files -- ignore anything with .git
      CORE.fs.glob(pkg.path, function(err, paths) {
        paths = paths.filter(function(p) {
          return !(p.match(/^\.(svn|git)\//) || p.match(/\/\.(svn|git)\/?/));
        });
        
        // copy just files we want to archive
        CORE.iter.each(paths, function(srcname, done) {
          var src = CORE.path.join(pkg.path, srcname);
          var dst = CORE.path.join(dstroot, srcname);
          
          CORE.fs.mkdir_p(CORE.path.dirname(dst), 511, function(err) {
            if (err) CORE.println('mkdir_p ' + CORE.path.dirname(dst));
            if (err) return done(err);
            CORE.fs.cp(src, dst, CORE.err(done));
          });
          
        // zipfile once finished
        })(function(err) {
          if (err) return done(err);

          var cmd = 'cd '+rootdir+'; zip '+zipfile+' -r '+filename;
          CORE.fs.exec(cmd, function(err) {
            var url = '/seed/assets?token='+token;
            remote.upload('POST', url, zipfile, function(err) {
              if (err) return done(err);
              CORE.fs.rm_r(rootdir, CORE.noop); //cleanup
              return done(err);
            });
          });
        });
        
      });  
    });
    
    return done();
  }
  
});

// all remote plugins must implement this method - returning a remote 
// object.
exports.openRemote = function(remoteUrl, done) {
  return done(null, new Remote(remoteUrl));
};

// ..........................................................
// REMOTE API
// 

// utility
function indexOfRemote(remotes, remoteUrl) {
  var idx = 0, lim = remotes.length, found = false;
  while(!found && (idx<lim)) {
    found = (remotes[idx].url === remoteUrl);
    if (!found) idx++;
  }
  return found ? idx : -1;
}

/**
  Returns a Remote instance for the remote Url based on the registered type
*/
exports.open = function(remoteUrl, done) {
  var configs = exports.config();
  var idx = indexOfRemote(configs, remoteUrl);
  if (idx<0) return done(null, null); // not found
    
  var pluginId = configs[idx].plugin;
  var remoteFactory = require(pluginId);
  if (!remoteFactory) return done('remote type ' + pluginId + ' not found');
  remoteFactory.openRemote(remoteUrl, done);
};

/**
  Returns all of the remotes registered on the system
*/
exports.remotes = function(done) {
  var configs = exports.config();
  CORE.iter.collect(configs, function(config, done) {
    exports.open(config.url, done);
  })(done);
};

// ..........................................................
// READING LOCAL CONFIG
// 

/**
  Takes a remote URL provided by the user and normalizes it - adding assumed URL components
*/
exports.normalize = function(str) {
  if (str.indexOf('://')<0) str = 'http://'+str;
  if (str.indexOf('/', str.indexOf('://')+3)<0) str = str+'/seed';
  return str;
};
  

/**
  Returns the known remote configs. 
*/
exports.config = function() {
  var remotes = require.loader.get('seed:remotes');
  if (!remotes && require.loader.seedPackage) {
    remotes = require.loader.seedPackage.get('seed:remotes');
  }
  if (!remotes) remotes = [];
  return remotes;
};

/**
  Adds a remote to the config.  Returns true if success or false if it was 
  already present
*/
exports.config.add = function(remoteUrl, moduleId) {
  
  if (!moduleId) moduleId = 'seed:remote';
  
  var remotes = exports.config().slice(),
      loc     = remotes.length,
      idx     = -1;

  // find the idx with the url.  
  while((idx<0) && (--loc>=0)) if (remotes[loc].url===remoteUrl) idx=loc;
  if ((idx>=0) && (remotes[idx].plugin === moduleId)) return false; //exists
  
  if (idx>=0) remotes[idx].plugin = moduleId;
  else remotes.push({ url: remoteUrl, plugin: moduleId });
  require.loader.set('seed:remotes', remotes);
  require.loader.writeConfig(); 

  return true;
};

/**
  Removes a remote from the config.  Returns true if removes, false if not 
  in config
*/
exports.config.remove = function(remoteUrl) {

  var remotes = exports.config(),
      loc     = remotes.length,
      idx     = -1;

  // find the idx with the url.  
  while((idx<0) && (--loc>=0)) if (remotes[loc].url===remoteUrl) idx=loc;
  if (idx<0) return false; // not in list already

  remotes = remotes.slice(0,idx).concat(remotes.slice(idx+1));
  require.loader.set('seed:remotes', remotes);
  require.loader.writeConfig(); 

  return true;
};
