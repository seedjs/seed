// ==========================================================================
// Project:   Seed - Flexible Package Manager
// Copyright: ©2009-2010 Apple Inc. All rights reserved.
// License:   Licened under MIT license (see __preamble__.js)
// ==========================================================================

if (!require.seed) throw "Can only load from within seed";

var Co = require('co');
var Cmds = require('commands');
var Package = require('package');
var REMOTE = require('remote');
var semver = require('semver');

exports.summary = "Install or update a package";
exports.usage = "install [PACKAGE..PACKAGEn] [OPTIONS]";
exports.options = [
  ['-V', '--version VERSION', 'Version of package to install'],
  ['-d', '--domain SOURCE', 'Preferred domain to use for installing'],
  ['-r', '--remote REMOTE', 'Preferred remote to use for installing'],
  ['-D', '--dependencies', 'Install missing dependencies (default)'],
  ['-n', '--no-dependencies', 'Do not install missing dependencies']
];

exports.desc = [
"Installs one or more packages, including any dependencies, from a local or",
"remote source.  Pass the names of one or more packages to discover them on",
"a remote server or pass a filename of an existing package to install it.",
"\n",
"\nFor local packages, you can reference either the package directory or a zip", "or seed of the package"].join(' ');

//......................................................
// SUPPORT METHODS
//

function collectState(args, opts) {
  var ret = { dependencies: true, domain: 'local' };
  
  var keys = ['version', 'domain', 'remote'];
  keys.forEach(function(key) {
    opts.on(key, function(k, value) { ret[key] = value; });
  });
  
  opts.on('dependencies', function() { ret.dependencies = true; });
  opts.on('no-dependencies', function() { ret.dependencies = false; });
  ret.packageIds = opts.parse(args);
  return ret ;  
}

// ..........................................................
// INSTALL JOB
// 

/*
  An install job handles the task of actually installing one or more packages
  into a repository.  Basically each package we want to install must go 
  through the following steps:

  1. Stage the package.  The package contents must be actually downloaded 
     and unzipped.  
     
  2. Resolve any dependencies.  Dependent packages must install first.
  
  3. Install into source.
*/
var InstallContext = Co.extend({
  
  init: function(source, remotes, dependencies) {
    this.source = source;
    this.remotes = remotes;
    this.includeDependencies = dependencies;
    this.descriptors = {}; // known package descriptors by packageId/vers
    this._jobs = {};
    this._cache = {};
  },

  // ..........................................................
  // INTERNAL DESCRIPTOR MANAGEMENT
  // 
  
  /**
    Returns a package descriptor in cache matching the named version.
    If exact only returns if version is an exact match.  If no match is found
    returns null.
  */
  descriptorFor: function(packageId, version, exact) {
    var desc = this.descriptors[packageId], ret, cur;
    if (!desc) return null; // not found
    
    for(var idx=0;idx<desc.length;idx++) {
      cur = desc[idx];

      // no version  or compatible version
      if (!version || (!exact && semver.compatible(version, cur.version))) {
        if (!ret || (semver.compare(ret.version, cur.version)>0)) ret = cur;
        
      // exact version required
      } else if (cur.version === version) ret = cur;
    }
    
    return ret ;
  },

  /**
    Adds a descriptor to the local cache.  If overlay is true or omitted,
    replaces any existing descriptor
  */
  addDescriptor: function(desc, overlay) {
    var packageId = desc.name, descriptors, idx, lim, found;
    
    descriptors = this.descriptors[packageId];
    if (!descriptors) descriptors = this.descriptors[packageId] = [];
    lim = desc.length;
    for(idx=0;!found && idx<lim; idx++) {
      if (descriptors[idx].version === desc.version) found = true;
    }
    
    if (found) {
      if (!overlay) return false;
      descriptors[idx] = desc;
    } else descriptors.push(desc);
    return true;
  },
  
  buildDescriptorFromPackage: function(pkg) {
    return {
      name:         pkg.name(),
      version:      semver.normalize(pkg.version()),
      dependencies: pkg.info('dependencies') || {},
      remote:       null,
      path:         pkg.path
    };
  },
  
  /**
    Converts packageInfo retrieved from a remote into a descriptor
  */
  buildDescriptorFromRemote: function(remotePackageInfo, remote) {
    return {
      name: remotePackageInfo.name,
      version: semver.normalize(remotePackageInfo.version),
      dependencies: remotePackageInfo.dependencies || {},
      remote: remote,
      info:   remotePackageInfo,
      path: null
    };
  },
  
  /**
    Opens a package at the named path and extracts a package descriptor
  */
  loadDescriptor: function(path, done) {
    var context = this;
    Package.open(path, function(err, pkg) {
      if (err) return done(err);
      if (!pkg) return done(null, null);
      var ret = context.buildDescriptorFromPackage(pkg);
      context.addDescriptor(ret, true); // replace whatever is in cache
      return done(null, ret);
    });
  },
  
  /**
    Lookup descriptor in cache.  If not found, search remotes
  */
  findDescriptor: function(packageId, version, exact, done) {
    var ret = this.descriptorFor(packageId, version, exact);
    if (ret) return done(null, ret); // found it
    
    // search remotes for packageId in order...
    if (!version || !exact) exact = null;
    var opts = { 
      name: packageId, 
      version: version, 
      exact: exact,
      dependencies: this.includeDependencies ? 'true' : 'false'
    };

    var context = this;
    Co.find(this.remotes, function(remote, done) {
      remote.list(opts, function(err, response) {
        if (err) { Cmds.verbose('Warning: ' + err); }
        if (err || !response) return done(null, false); // not found
        response.forEach(function(packageInfo) {
          var desc = context.buildDescriptorFromRemote(packageInfo, remote);
          context.addDescriptor(desc, false); // don't overlay cache
          context.prepare(desc, Co.noop); // can run in parallel
        });
        
        ret = context.descriptorFor(packageId, version, exact);
        return done(null, !!ret); // stop when found remote
      });
      
    })(function(err) {
      if (err) return done(err);
      else return done(null, ret);
    });
    
  },
  
  // ..........................................................
  // PREPARING
  // 
  
  /**
    Prepares a package for install.  Calls done() when package is prepared.
    Descriptor should now have a path you can use to install from.
  */
  prepare: function(desc, done) {
    var job = desc.prepareJob;
    if (!job) {
      var context = this;
      job = desc.prepareJob = Co.once(function(done) {
        // if we already have a local path, then this package is already
        // prepared for install
        if (desc.path) return done();
        
        // Otherwise, we should have a remote that we can ask to fetch
        if (!desc.remote) {
          return done('internal error: missing remote '+Co.sys.inspect(desc));
        }
        
        desc.remote.fetch(desc.info, function(err, path) {
          if (!err && !path) {
            err = "Could not fetch "+desc.packageId + ' ('+desc.version+')';
          }
          if (err) return done(err);
          desc.path = path;
          return done();
        });
      });
    }
    
    job(done);
  },
    
  // ..........................................................
  // INSTALL
  // 
  
  /**
    main entry point.  install the passed packageId + version into the 
    named source.  Use the named remotes if needed to find the packageId.
    Invokes the callback when complete.
    
    You can call this several times on the same packageId ... we'll only 
    invoke them once
  */
  install: function(packageId, version, exact, force, done) {
    
    var context = this;
    
    if ('function' === typeof force) {
      done = force;
      force = false;
    }
    
    // packageId may be either a path or a simple packageId.  If it is a 
    // path then add the descriptor to the DB immediately
    Co.chain(function(done) {
      // looks like a path if it begins with ., .., or has a /
      if ((packageId[0]==='.') || (packageId.indexOf('/')>=0)) {
         context.loadDescriptor(packageId, done);
        
      // it's not a path - so try to find the descriptor in the cache or 
      // load it from a remote
      } else {
        context.findDescriptor(packageId, version, exact, done);
      }
    },

    // now we have a package descriptor.  Get an install job for this desc
    // and use it
    function(desc, done) {
      if (!desc) return done(packageId + ' not found');
      
      var job = desc.installJob;
      if (!job) {
        job = desc.installJob = Co.once(function(done) {

          // satisfy dependencies first...
          Co.chain(function(done) {
            context.prepare(desc, function(err) {
              if (err) return done(err);
              context.installDependencies(desc, Co.err(done));
            });

          // then open this package and install it
          }, function(done) {
            Package.open(desc.path, function(err, pkg) {
              if (!err & !pkg) err = packageId  + ' is invalid';
              if (err) return done(err);
              context.source.install(pkg, function(err) {
                if (err) return done(err);
                if (desc.remote) {
                  desc.remote.cleanup(desc.path, Co.err(done));
                } else return done();
              });
            });
          })(done);
        });
      }

      job(done); // invoke callback once this particular job is done
      
    })(done);
  },
  
  /**
    Ensures all dependencies are installed before invoking done
  */
  installDependencies: function(desc, done) {
    var context = this;
    
    if (!this.includeDependencies) return done(); // skip
    
    // map to array to process in parallel
    var deps = [];
    for(var packageId in desc.dependencies) {
      if (!desc.dependencies.hasOwnProperty(packageId)) continue;
      var version = desc.dependencies[packageId];
      deps.push({ packageId: packageId, version: version });
    }
    
    Co.parallel(deps, function(dep, done) {
      context.install(dep.packageId, dep.version, false, false, done);
    })(Co.err(done));
  }
  
});

//......................................................
// COMMAND
//

exports.invoke = function(cmd, args, opts, done) {
  var state, packageIds, source, sources;
  
  state = collectState(args, opts); 
  packageIds = state.packageIds; 
  if (!packageIds || packageIds.length===0) {
    return Cmds.fail('You must name at least one package', done);
  }
  
  if (state.version && packageIds.length!==1) {
    return Cmds.fail(
      '--version switch can only be used with one package name',
      done);
  }

  // find the repository to use for installing
  sources = require.seed.sources || [];
  sources.forEach(function(cur) {
    if (!source && (cur.domain===state.domain)) source = cur;
  });
  
  if (!source) {
    return Cmds.fail("Cannot find install location for domain ", state.domain, done);
  }
  
  // find remotes needed to install.  If a remote is named just use that.
  // otherwise just get all remotes
  Co.chain(function(done) {
    var remoteUrl = state.remote;
    if (remoteUrl) {
      remoteUrl = REMOTE.normalize(remoteUrl);
      REMOTE.open(remoteUrl, function(err, remote) {
        if (err) return done(err);
        if (remote) return done(null, [remote]);
        
        // if remote is unknown assume it's the default type
        REMOTE.openRemote(remoteUrl, function(err, remote) {
          if (err) return done(err);
          return done(null, [remote]);
        });
        
      });
      
    } else {
      REMOTE.remotes(done);
    }
  },

  // start a new install job and install each package id in parallel.  Invoke
  // done once the install is complete
  function(remotes, done) {
    
    var context = new InstallContext(source, remotes, state.dependencies);
    Co.parallel(packageIds, function(packageId, done) {
      context.install(packageId, state.version, true, done);  
    })(done);
    
  })(function(err) { return done(err); });
  return done();
};

