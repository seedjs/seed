# Seed
## Flexible Package Manager for Node

Seed is a package manager for installing CommonJS-based packages.  You can use 
Seed to simplify distributed development of JavaScript-based code.  

Since a lot of people use packages differently, Seed's goal is to remain very
small and extensible through plugins.  You can easily add new JS loaders,
support for new types of local and remote seed repositories, and even replace
the require system itself.

Long term, this system will form the basis of a new set of build tools for
the [SproutCore HTML5 Platform](http://www.sproutcore.com) so you will be able
to build Seed-based JavaScript apps for the server, web browser, and other 
clients.

## Installing Seed

First, you need to install a JS command-line environment.  Be sure to edit the
'seed' binary to change the '{CMD}' string at the top of the name of the 
js command you want to invoke.

Next, clone this repository to your local system and run the install script:

	cd SEED_DIR
	git submodule init
	git submodule update
	./scripts/install.js

You should also add ~/.seeds/bin to your PATH if you want to run binaries 
installed by seed from the command line.

## Usage

Once you've installed seed, you can install a package by cloning a repository
and running:

	seed install [PATH_TO_PACKAGE]
	
This will install the package on your system so you can access it from code.
In your code, you can load a package module from seed with code like:

	var seed = require('seed'); // get package manager
	var aPackageModule = seed.require('package_name:some/module');
	
Alternatively, you can get your entire app to run from seed which will make 
it easier to access seed-based code by putting the following in the a main.js
file for your app:

	var seed = require('seed');
	var pkg = seed.register(__dirname); // register current dir as a package
	seed.require('main', pkg).main();

From then on everything in main() will use seed a the require.
	
## Current Status

The following functionality has been implemented so far:

*	Package-aware require system, including semantic versioning support
	* 	use require('foo') to require modules from the current package
	* 	use require('foo:bar') to require the bar module from the foo 
		package
 	* 	Traditional requires such as require('./foo') and require(fs) still 
        work as expected
*	Install/remove packages into local repository
* 	Seed command line tool - including support for loading plugin commands

Additional features still planned:

*	Install packages from a remote server
*	A built-in remove server
*	Package JS for loading in a browser (using [tiki](http://github.com/sproutit/tiki) loader)


