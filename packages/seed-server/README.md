# Seed Server

A seed server hosts available seeds for you to search and install.  It will
also be able to automatically respond to Git post-commit hooks to 
automatically deploy new versions.

# Current Status

The server is not implemented yet.  The following describes the intended 
behavior

# Usage

Start a new server instance with:

	seed server start
	
By default, server cache is stored in ~/.seeds/server.  You can name an 
alternate root with the --cache option.  It will also start on the port 4050.
You can change this with the --port option.

# HTTP API

The seed server is a RESTful HTTP service

## Authentication

Authentication is handled via an API token which is assigned to a user account
on the system.  The token must be passed as a query parameter to any mutation
URL as well as to any package that is marked private.

### Obtaining a New API token

To obtain an new token you must have an existing, valid token.  This basically
means someone else who already has access must give you access as well. Get 
a new token with the URL:

	POST /seed/users/cjolley/token
	
The username is the name that will be used to assign permissions.  This will
return a 201 Created with a Location header identifying where you can fetch
the new token.  In general the new token is the last component of the URL.
Probably something like:

	/seed/tokens/1234
	
In this case `1234` would be the token.


### Withdrawing a Token

If you think a token is compromised or want to otherwise cancel the token just
delete it:

	DELETE /seed/tokens/1234
	
### Setting User Permissions

To give a particular user permission to modify a package, you must create an
ACL entry for the user:

	PUT /seed/access/jake/cjolley
	{ "access": "commit" }

This will make cjolley a committer for the jake package.  	You can also leave 
the body blank - this will automatically grant commit access.

You can withdraw permission by deleting the same resource:

	DELETE /seed/access/jake/cjolley

Valid access modes include "commit" and "retrieve".  

Requests made with no API token are given the "anonymous" username.  You can
make a package private by deleting the anonymous access.

## Finding Packages

You can search for package information by getting the /seed/packages URL.
You can specify the following query options:

*	**`name=NAME`:** the name of the package info to retrieve
*   **`version=VERSION`:** searches for the exact version in the repo
*   **`compatible=VERSION`:** returns any comptaible versions
*	**`dependencies=true|false`:** return also package info for dependencies 
	(this defaults to false if not specified)
*	**`q=KEYWORDS`:** returns any packages matching the comma or space 
	separated keywords
	
Example URL:

	GET /seed/packages?name=sproutcore&dependencies=true&compatible=1.0.1000
	
The return value from this request is a JSON document describing any matching
packages.  The format is:

	{
		"packages": [
			{
				"name": "sproutcore",
				"version": "1.0.1000",
				"dependencies": {
					"seed": "1.1",
					"tiki": "2.1.12"
				},
				"description": "SproutCore HTML5 Application Framework",
				"link-self": "/seeds/packages/jake/0.1.2/package.json",
				"link-asset": "/seeds/packages/jake/0.1.2/asset.zip"
			}
		]
	}
	
The most important parts are the `name`, `version`, and `location` fields.  
The `name` and `version` fields should be self explanatory.  The `location`
field describes the URL you should use to download the asset.  If the field 
does not begin with a full URL (i.e. "http://hostname/...") then attach the 
same hostname used to make this request.

If you pass `dependencies=true` as a query parameter, then the returned 
results will include both the `packages` field and a `dependencies` field.  
The dependencies field is an array of package descriptions that do not match
the search query but appear in the dependency chain of those that do.  

If a package matches the search query _and_ is a dependency of another 
package then it will appear in the `packages` field only, not in both.


## Retrieving Individual Package Information

In general, you should only retrieve individual package information by 
following the URLs provided in a general /seed/packages search.  This way 
seed server can change its other URL structures without breaking your code.

You can, however, retrieve the information about a single package by calling 
GET from the package URL.  The package URL contains the package name and 
version.

	GET /seed/packages/jake/0.1.2/package.json
	

## Downloading a Package

You will almost always download a package after discovering the package URL
via a search.  You should never try to compute directly the URL used to 
download the package. 

In general, once you obtain an URL, you simply GET the URL to download the 
package.  

	GET /seed/packages/jake/0.1.2/asset.zip


## Adding a Package

Post a ZIP or tarball'd version of your package content to:

	POST /seed/packages
	
The return value will be "201 Created" with a Location header containing the URL where you can fetch the new package information.  Make sure your
Content-Type header is set properly or else the package will not be properly 
installed.

## Withdrawing a Package

Generally once a package is published it should not be removed.  It is 
possible to withdraw a package by sending a DELETE to the package URL.
However this should be exercised with caution.

	DELETE /seed/packages/jake?version=0.1.2&token=TOKEN


## Git Post Commit Hooks

Seed server can automatically update a particular package.  POST'ing to this
URL will cause the server to clone the git repository and try to update the
named package or packages.  It will look at the package in the repository. If
the version named in the package.json is not a currently published version, it
will be added to the repository automatically.

A post commit hook should look like this:

	POST /seed/ping?from=GIT_URL&paths=path1,path2&token=TOKEN
	
The query parameters are very important for this to work.  Note that the body 
of the post is ignored.  Your queries should be:

*	**`from`:** URL to use to clone the git repository
*	**`paths`:** optional one or more paths within the repository where 
	packages can be found
*	**`token`:** API token.  the token must match a user with permission to
	update any discovered packages or they will be ignored

## Event Feeds

Seed server maintains event feeds for each package and for the services as 
a whole.  You can use these event feeds, for example, to build a UI around 
the service.

To get a feed of all the events that have occurred on a particular package
use the form:

	GET /seed/packages/jake/events

Or to get a feed of all the events that have occured on packages a particular
user has access to use:

	GET /seed/users/cjolley/events
	
To get the public feed (essentialy the events feed for the anonymous user),
use:

	GET /seed/users/anonymous/events
	
All event feeds take an optional `page` param which can be used to select a
page of events.  Event feeds are JSON with the following format:

	{
		"events": [
			{
				"kind": "kind of event",
				"description": "human readable description",
				"created": "time event occurred"
			}
		]
	}

Other metadata may be included in event feeds as well.
