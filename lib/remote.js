// ==========================================================================
// Project:   Seed - CommonJS Runtime
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================
/*globals process */

var Co = require('./private/co');
var HTTP = require('http');
var URL  = require('url');
var QUERYSTRING = require('querystring');
var semver = require('semver');
var Config = require('./config');

/**
  Describes a remote service for fetching seed packages.  The default version
  talks to seed-server installs but you can create your own interface for 
  any service you want.
*/

// default class
var Remote = Co.extend({

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

    var query = this.query ? Co.mixin({}, this.query) : {};
    if (query2) Co.mixin(query, query2);
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
    }

    var req = client.request(method, path, headers || {});
    req.addListener('response', function(response) {

      response.setBodyEncoding("utf8");
      var data = [];
      
      isJson = response.headers['content-type'] === 'application/json';
      response.addListener("data", function(chunk) { data.push(chunk); });
     
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
    
    req.close();
  },
  
  /**
    Downloads an asset from the HTTP server to the named target location.
    Creating any directories in the process.  Invokes done when complete
  */
  download: function(path, url, headers, done) {
    
    // cleanup after a download if we failed
    var cleanup = function(path, fd) {
      Co.fs.close(fd, function(err) {
        Co.fs.rm(path, Co.noop);
      });
    };

    if ('function' === typeof headers) {
      done = headers;
      headers = undefined;
    }

    var remote = this;
    
    // first make sure we have a directory to write to and then open a 
    // file for writing
    Co.chain(function(done) {
      Co.fs.mkdir_p(Co.path.dirname(path), 511, function(err) {
        if (err) return done(err);
        Co.fs.open(path, 'w+' , 511, done);
      });
      
    // next, open a connection to the server and download...
    }, function(fd, done) {
      
      // use a queue to control writing to disk.  This allows us to stream
      // receiving a file.
      
      var level = 1;
      function endWrite() {
        if (--level <= 0) {
          Co.verbose('download complete');
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
          Co.fs.write(fd, chunk, null, 'binary', function(err) {
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

      req.close();

    })(done);
  },
  
  
  upload: function(method, url, path, headers, done) {

    if ('function' === typeof headers) {
      done = headers;
      headers = undefined;
    }

    var remote = this;
    
    // open file for reading
    Co.fs.stat(path, function(err, stat) {
      if (err) return done(err);
      var len = stat.size;
      Co.verbose("Uploading " + len + " bytes");
      
      Co.fs.open(path, 'r', 0, function(err, fd) {
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

        var readNext = function(done) {
          if (reqError) return done(reqError);
          if (pos>=len) return done();

          Co.fs.read(fd, 4096, pos, 'binary', function(err, data, byteCnt) {
            if (err) return done(err); // failed!
            req.write(data, 'binary'); // write partial
            pos += byteCnt;
            readNext(done);
          });
        };

        readNext(function(err) {
          doneReading = true;
          
          Co.fs.close(fd);
          req.close();
          
          if (err) return done(err);
        });

      });
      
    });
  },
  
  /**
    Gets a tokens config file on disk.  Stored per user.
  */
  tokens: function(done) {
    var remote = this;
    if (remote._tokensConfig) return remote._tokensConfig.open(done);
    
    var path = Co.path.normalize('~/.seeds/tokens.json');
    Co.path.exists(path, function(err, exists) {
      if (err) return done(err);
      if (exists) {
        remote._tokensConfig = Config.open(path, done);
      } else {
        remote._tokensConfig = Config.setup(path, done);
      }
    });
  },
  
  /** 
    Returns a new tmp path
  */
  tmproot: function() {
    var path = require('commands').preferredSource().path;
    return Co.path.join(path, 'tmp', Co.uuid());
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
    Co.verbose('fetching ' + url); 
    this.download(filepath, url, function(err){
      if (err) return done(err);
      Co.verbose('unzipping ' + filepath);
      Co.sys.exec('unzip ' +filepath+' -d '+path, function(err) {
        if (err) return done(err);
        Co.fs.readdir_p(path, function(err, dirs) {
          if (err) return done(err);
          Co.fs.rm_r(filepath, Co.noop); // cleanup zipfile
          if (!dirs || (dirs.length===0)) return done(null, null);
          return done(null, Co.path.join(path, dirs[0]));
        });
      });
    }); 
  },
  
  /**
    Invoked by the installer when we are done installing the path you 
    provided.  Use this to cleanup tmpfiles
  */
  cleanup: function(path, done) {
    Co.verbose('cleaning up tmp at ' +path);
    Co.fs.rm_r(Co.path.dirname(path), Co.err(done));
  },
  
  /**
    Prompts for username/password then obtains a token.  Returns error and
    token if obtained
  */
  login: function(usernames, done) {   
    var remote = this;
    
    // collect username
    Co.chain(function(done) {
      Co.sys.puts("Login to "+remote.url);
      
      if (usernames && usernames.length>0) return done(usernames[0]);

      Co.sys.puts("Username:");
      Co.prompt(done);

    // collect password
    }, function(username, done) {
      Co.sys.puts("Password:");
      Co.prompt(function(err, password) {
        return done(err, username, password);
      });
      
    // go get a token from remote...
    }, function(username, password, done) {
      Co.prompt.done();
      username = username.slice(0,-1); // cut newline
      password = password.slice(0,-1);
      
      Co.verbose("Obtaining login token for "+username+" from "+remote.url);
      
      var digest = require('private/md5').b64(password);
      var opts = { username: username, digest: digest };
      opts.body = { "user": username };
      remote.request('POST', 'tokens', opts, function(err, status, data) {
        if (!err && (status<200) && (status>=300)) err = status;
        if (err) return done(err);

        // write token into local storage for future use
        var tokenId = data.id;       
        if (!tokenId) {
          return done("Server did not return token (data="+Co.sys.inspect(data)+")");
        }
        
        remote.tokens(function(err, tokens) {
          if (err) return done(err);
          var token = tokens.attr(remote.url);
          token = token ? Co.mixin({}, token) : {};
          token[username] = tokenId;
          tokens.attr(remote.url, token);
          tokens.write(function(err) {
            if (err) return done(err);
            return done(null, tokenId);
          });
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
      Co.sys.puts("Removing all tokens for "+remote.url);
    } else {
      Co.sys.puts("Removing tokens for "+usernames.join(',')+" on "+remote.url);
    }
    
    remote.tokens(function(err, tokens) {
      var active = tokens.attr(remote.url);
      if (!active || (Object.keys(active).length===0)) {
        Co.verbose("  No login tokens found");
        return done(); // nothing to do
      }
      
      active = Co.mixin({}, active);

      if (!usernames) usernames = Object.keys(active);
      Co.each(usernames, function(username, done) {
        var token = active[username];
        if (token) {
          delete active[username];
          Co.verbose('  Deleting '+username+' token '+token);
          remote.request("DELETE", 'tokens/'+token, {}, function(err, status){
            if (!err && (status<200) && (status>=300)) err = status;
            if (err) return done(err);
            done();
          });
        } else Co.verbose('  No login token for '+username);
        
      })(function(err) {
        if (err) return done(err);
        tokens.attr(remote.url, active);
        tokens.write(Co.err(done));
      });
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
    Co.chain(function(done) {
      Co.sys.puts("Create new account for " + remote.url);
      Co.sys.puts("Username:");
      Co.prompt(function(err, value) {
        if (err) return done(err);
        username = value.slice(0,-1);
        if (username.length===0) return done("username cannot be empty");
        return done();
      });
    
    // read name
    }, function(done) {
      Co.sys.puts("Real name:");
      Co.prompt(function(err, value) {
        if (err) return done(err);
        name = value.slice(0,-1);
        if (name.length===0) return done("Name cannot be empty");
        return done();
      });

    // get email
    }, function(done) {
      Co.sys.puts("Email:");
      Co.prompt(function(err, value) {
        if (err) return done(err);
        email = value.slice(0,-1);
        if ((email.length===0) || (email.indexOf('@')<0)) {
          return done("Must provide valid email");
        }
        
        return done();
      });
      
    // get password
    }, function(done) {
      Co.sys.puts("Password:");
      Co.prompt(function(err, value) {
        if (err) return done(err);
        password = value.slice(0,-1);
        if (password.length===0) return done("password cannot be empty");
        return done();
      });
      
    // create account
    }, function(done) {
      Co.prompt.done(); // no more data required
      Co.sys.puts("Creating account...");

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
        remote.tokens(function(err, tokens) {
          if (err) return done(err);
          var token = tokens.attr(remote.url);
          token = token ? Co.mixin({}, token) : {};
          token[username] = tokenId;
          tokens.attr(remote.url, token);
          tokens.write(function(err) {
            if (err) return done(err);
            return done(null, tokenId);
          });
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
      remote.tokens(function(err, tokens) {
        if (!err && !tokens) err = "Could not open tokens file";
        if (err) return done(err);
        
        // attempt to find stored token
        var token = tokens.attr(remote.url);
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
        else return done(err, token);
        
      });
      
    })(function(err, token) {
      if (!err && !token) err = "Could not obtain token for remote";
      if (err) return done(err);
      Co.verbose("pushing with token " + token);
      return remote._push(pkg, token, done);
    });
  },
    
  _push: function(pkg, token, done) {

    var rootdir = this.tmproot();
    var filename = pkg.name()+'-'+semver.normalize(pkg.version());
    var dstroot = Co.path.join(rootdir, filename);
    var zipfile = dstroot + '.zip';
    var remote= this;
    
    Co.fs.mkdir_p(rootdir, 511, function(err) {
      if (err) return done(err);
      
      // collect files -- ignore anything with .git
      Co.fs.glob(pkg.path, function(err, paths) {
        paths = paths.filter(function(p) {
          return !(p.match(/^\.(svn|git)\//) || p.match(/\/\.(svn|git)\/?/));
        });
        
        // copy just files we want to archive
        Co.each(paths, function(srcname, done) {
          var src = Co.path.join(pkg.path, srcname);
          var dst = Co.path.join(dstroot, srcname);
          
          Co.fs.mkdir_p(Co.path.dirname(dst), 511, function(err) {
            if (err) Co.sys.puts('mkdir_p ' + Co.path.dirname(dst));
            if (err) return done(err);
            Co.fs.cp(src, dst, Co.err(done));
          });
          
        // zipfile once finished
        })(function(err) {
          if (err) return done(err);

          var cmd = 'cd '+rootdir+'; zip '+zipfile+' -r '+filename;
          Co.sys.exec(cmd, function(err) {
            var url = '/seed/assets?token='+token;
            remote.upload('POST', url, zipfile, function(err) {
              if (err) return done(err);
              Co.fs.rm_r(rootdir, Co.noop); //cleanup
              return done(err);
            });
          });
        });
        
      });  
    });
    
    return done();
  }
  
});
exports.Remote = Remote;

// all remote plugins must implement this method - returning a remote 
// object.
exports.openRemote = function(remoteUrl, done) {
  return done(null, new Remote(remoteUrl));
};

// ..........................................................
// REMOTE API
// 

// utility
function findDomainConfig(domain, done) {
  var sources = require.seed.sources || [],
      source, ret;

  sources.forEach(function(src) {
    if (src.domain===domain || !source) source = src;
  });

  ret = source ? source.config : null;
  done(null, ret);
}

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
  Takes a remote URL provided by the user and normalizes it - adding assumed URL components
*/
exports.normalize = function(str) {
  if (str.indexOf('://')<0) str = 'http://'+str;
  if (str.indexOf('/', str.indexOf('://')+3)<0) str = str+'/seed';
  return str;
};
  
/**
  Returns a Remote instance for the remote Url based on the registered type
*/
exports.open = function(remoteUrl, done) {
  exports.config(function(err, configs) {
    if (err) return done(err);
    var idx = indexOfRemote(configs, remoteUrl);
    if (idx<0) return done(null, null); // not found
    
    var remoteFactory = require(configs[idx].moduleId);
    if (!remoteFactory) return done('remote type ' + moduleId + ' not found');
    remoteFactory.openRemote(remoteUrl, done);
  });
};

/**
  Returns all of the remotes registered on the system
*/
exports.remotes = function(done) {
  exports.config(function(err, configs) {
    if (err) return done(err);
    Co.collect(configs, function(config, done) {
      exports.open(config.url, done);
    })(done);
  });
};

/**
  Returns the known remote configs - if you specify an optional domain 
  searches that domain only.  Otherwise merges all domains
*/
exports.config = function(domain, done) {
  if ('function' === typeof domain) {
    done = domain;
    domain = null;
  }
  
  var sources, source, ret ;
  
  if (domain) {
    findDomainConfig(domain, function(err, config) {
      if (err) return done(err);
      if (config) config = config.attr('seed-remotes');
      return done(null, config);
    });
    
  } else {
    ret = [];
    Co.each((require.seed.sources || []), function(src, done) {
      var remotes = src.info('seed-remotes');
      if (remotes) ret = ret.concat(remotes);
      done();
    })(function(err) { done(err, ret); });
  }
  
};

/**
  Adds a remote to the config.  Invokes callback with true if success or false
  if it was already present (or an error if an error occurred);
*/
exports.config.add = function(domain, remoteUrl, moduleId, done) {
  if ('function' === typeof moduleId) {
    done = moduleId;
    moduleId = null;
  }
  
  if (!moduleId) moduleId = 'seed:remote';
  
  findDomainConfig(domain, function(err, config) {
    if (err || !config) return done(err || ('Domain '+domain+' unknown'));
    var idx, remote, remotes = config.attr('seed-remotes');

    remotes = remotes ? remotes.slice() : [];
    idx = indexOfRemote(remotes, remoteUrl);
    if ((idx>=0) && (remotes[idx].moduleId === moduleId)) {
      return done(null, false); // already exists
    
    } else {
      if (idx>=0) {
        remotes[idx].moduleId = moduleId;
        remotes[idx].url = remoteUrl;
      } else {
        remotes.unshift({ url: remoteUrl, moduleId: moduleId });
      }
      config.attr('seed-remotes', remotes);
      config.write(function(err) {
        if (err) return done(err);
        else return done(null, true); // added or changed
      });
    }
  });
};

/**
  Removes a remote from the config.  Invokes the callback with true if 
  success or false if the remote is not in the config.
*/
exports.config.remote = function(domain, remoteUrl, done) {
  findDomainConfig(domain, function(err, config) {
    if (err || !config) return done(err || ('Domain '+domain+' unknown'));
    var idx, remotes = config.attr('seed-remotes');
    idx = indexOfRemote(remotes, remoteUrl);
    if (idx<0) {
      return done(null, false); // nothing to do
    } else {
      remotes = remotes.slice(0,idx).concat(remotes.slice(idx+1));
      config.attr('seed-remotes', remotes);
      config.write(function(err) {
        if (err) return done(err);
        else return done(null, true);
      });
    }
  });
};
