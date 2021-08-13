# DVblueprint

## About

DVblueprint is an out of the box Node.js REST server.

**Features**:

* Easily Extensible REST Interface
* Built-in support for PostgreSQL (Legacy: MySql and MongoDb)
* OAuth 2.0 Authentication Protocol
* User Signup / Registration
* Forgot Password Flow
* Rapid Route Prototyping
* Dynamic Data ('Push' framework) using Long-Polling
* Route Error Handling
* Email Templating
* AWS SES and S3 Integration
* Static File Server (Web Server)
* Extensive Logging & Health check features
* Self-Documenting API
* 12Factor app support
* RunQ - a distributed cron runner

## TODO CONSIDER AN INITIAL SETUP THAT DOES NOT INCLUDE A DATABASE, WHICH BRINGS IN A HALF DOZEN THINGS TO UPDATE
Adding a DB connection and schema and logic and config etc. is more than what we should discuss here. Maybe its own doc?
TODO: MAKBE ALL THE SUGGESTIONS TO CHANGE BLUEPRINT (IN THIS DOC) COULD BE MOVED TO THE BRANCH 'latest' VS. master-psql-es6

## Install Environment Dependencies
##### Install Node
The latest version of Node.js can be downloaded and isntalled from here: [download node](http://nodejs.org/download). To learn more, you can read the documentation here: [node.js docs](http://nodejs.org/documentation/)

##### ES6 Compatability
Most of the DVblueprint server is ported from [CoffeeScript](http://coffeescript.org) with heavy use of promises. It is now compatible with ES6. All of the examples below are going to be ES6.

##### Install Postgres
Some of the features in DVblueprint require a Postgres database, including Dynamic Push Data,
and OAuth 2.0 Authentication. Access to a DB server needs to be set up for these.

## Install DVblueprint

## Initialize Database
TODO: ADD A SCRIPT TO CREATE A DB / SCHEMA INTO THE REPO AND REFERENCE IT HERE (LIKE PSQL_RESET)

	$ cd my/workspace/directory/blueprint
	$ psql (command-line-options-to-script-to-create-a-db-and-schema-and-source-db/bootstrap.sql)
	$ note-using-db-name: local_yourapp_yourname


## Create Application Directory
The main application is its own directory which can be a repository. DVblueprint is going to be a package.json dependency.
Any subdirectories are your option. As the project grows you'll want routes and services and db mods in their own dir.
The following commands will setup an ideal project directory to run an application that
uses the DVblueprint server.

	$ cd my/workspace/directory
	$ mkdir my_app
	$ cd my_app
	$ npm init
	$ mkdir src src/routes src/services src/psql db db/scripts
	$ touch src/app.js src/base.js src/container.js

##### Reference DVblueprint in your package.json
Add/include in the "dependencies" section of package.json, a git url with the master-psql-es6 branch
DVblueprint is publicly available.

	"blueprint": "git+https://git@bitbucket.org/dv-mobile/blueprint.git#master-psql-es6"

## Configure the Application
##### Configuration Files
When the Blueprint server first launches, it will load default configuration details
and merge it with the config file that matches the running processes enviroment.

Create a local config file using the editor of your choice:

	$ cd my/workspace/directory/my_app
	$ vi src/base.js

##### Configure Database
 NOTE: For cmdline may also need to include in e.g. PGPASSWORD

	/*
 	 * base.js
	*/
	module.exports= {
		db: {
			psql: {
				pool: {
					host: 'localhost',
					port: 5432, 	// PSQL uses this port number
					user: 'postgres',
					password: 'yourpass',
					database: 'local_yourapp_yourname',
				}
			}
		}
	}


## Create Server File
Create main application file

	$ cd my/workspace/directory/my_app
	$ vi src/app.js

Add the following to the main application file:

	//
	// app.js: Main launch point for the application
	//

	const blueprint= require( "blueprint")
	// Lists of modules to include on start-up
	const services= []
	const routes= []
	const psql_mods= []

TODO WE CAN INSTITUTE THE IDEA OF MAKING THESE VARS A HASH, SO ONLY WHAT IS SET IS PASSED, AND WITH BETTER READABILITY
I.E. blueprint.start({ listen: true, services: [], routes: []})
	// start= function(listen?, services, routes, mysql?, mysql_mods, psql?, psql_mods, mongo?, more_config, more_kit)
	const kit= await blueprint.start( true, services, routes, false, [], false, psql_mods, false, {}, {})
	const port= kit.services.config.api.port

	console.log( 'Myapp API server is in serivice.', ` http://localhost:${port}/api/v1`)

## Global depedencies
Logging is enhanced with bunyan, so using it to read the logs is preferable

	$ sudo npm install bunyan -g

## Running
To run the application:

	$ CHECK - CHANGE BLUEPRINT TO DEFAULT TO THIS DOCUMNETED PREFERED DIR STRUCTURE: export npm_config_env="local_dev"
	$ CHECK: export npm_config_config_dir="config"
	$ node src/app.js | bunyan -o short

TODO ENSURE PORT 9500 IS THE ONE USED (MAYBE A DEFAULT FROM BLUEPRINT?)
Vist the REST API Documentation: [http://localhost:9500/api/v1](http://localhost:9500/api/v1)
Vist the Example Todo Web-App: [http://localhost:9500/](http://localhost:9500/)

## Creating Custom Routes
The following is an example of how to add a route module that exposes endpoints for 'Fruit' resources.

### Create Route Module File
Create a Route Module within the application's *routes* directory using the editor of your choice:

	$ cd my/workspace/directory/my_app
	$ vi routes/r_fruit.js

## TODO IS ADDING A ROUTE THE NEXT BEST THING? SEEMS LIKE IT.
This is probably what most people want to hear. The alternative is to describe better what just happened; how it works so far.
It might also be prudent to put anything more elaborate for e.g. route module into a separate doc/page for better future reference.

### Install Route Module
Add the following to the application's config file to install the Route Module:
NOTE: PEOPLE GET CONFUSED ALL THE TIME WITH UPPER/LOWER CASE, AND DUPLICATED NAMES, AND EVEN HAVING TO ADD THIS INFORMTION
CONSIDER A DEFAULT SECNARIO, WHERE A NAME LIKE FruitRoute OR FruitService COULD AUTO LOAD FruitRoute:calls FruitRoute routes/
ANOTHER OPION, SINCE BILL LIKES services/fruit_service.js AS A NAMING CONVENTION, FruitService MIGHT INVOKE:
service_modules: { FruitService: { class: 'FruitService', file: 'services/fruit_service.js' }} (I.E. WIHOUT THE USER HAVING TO ADD THIS TO THE CONFIG FILES)

r_fruit
	# local_dev.coffee
	module.exports= {
		db: {
			...
		},
		route_modules: {
			Fruit: {
				class: 'Fruit',
				file: 'routes/r_fruit',
			}
		}
	}

### Route Module Constructor
An instance of the Route Module will be created when the server is first fired up, and all endpoints defined in the module will be registered with Restify to be exposed over the API. The constructor will be passed the kit, which has access to all enabled services including the app config, and application logger (See creating a Custom Service). Best practice is to take what you need from the kit and attach to ***this (@)***.

Endpoints are defined by adding to the ***@endpoints*** variable of the module, and defining options for that endpoint.

TODO: CONSIDER DEFAULT THESE SO THEY ARE NOT IN THERE ALL THE TIME: use: true, wrap: 'default_wrap'
TODO: CONSIDER ALSO AUTO-BIND OF THESE METHODS; ALSO version: any: f() WAS EASIER WITH COFFEESCRIPT; TECHNICALLY WE NEVER USED A VERSION CHANGE TO THE API, INTERESTINGLY, AND AUTO DOCUMENTATION DOES NOT ACTUALLY WORK, ALSO RESTIFY UPDATED THE ROUTE VERSIONING AS WELL, SO NOT SURE IF THAT IS STANDARD NOW LIKE EXPRESS OR IF WE HAVE SOMETHING PORTABLE HERE
NOTE: REMOVING THE DB REFERENCES TO SIMPLIFY THE EXAMPLE:
NOTE: WE STARTED A PATTERN OF PUTTING THE RESOURCE NAME (WHICH MATCHED THE CLASS NAME) INTO this.resoruce.


	class Fruit {
		constructor(kit) {
			this.log= 		kit.services.logger.log
			this.config= 	kit.services.config
			this.sdb= 		kit.services.db.psql // TODO CONSIDER MOVING DB STUFF TO ANOTHER DOCUMENT

			# Fruit Endpoints
			@endpoints= {
				getFruit: {
					verb: 'get',
					route: '/Fruit'
					version: {
						any: this.S_GetFruit.bind( this)
					},
				},
				buyFruit: {
					verb: 'post',
					route: '/Fruit'
					version: {
						v1: this.S_BuyFruitOld.bind( this), // Legacy version 1 logic
						any: this.S_BuyFruit.bind( this)
					}
				},
				eatFruit: {
					verb: 'del',
					route: '/Fruit/:frid/eat'
					version: { any: this.S_EatFruit.bind( this) }
				}
			}
		}

		S_GetFruit(  ctx, pre_loaded) {}
		S_BuyFruitOld(  ctx, pre_loaded) {}
		S_BuyFruit( ctx, pre_loaded) {}
		S_EatFruit(  ctx, pre_loaded) {}
	}

	exports.Fruit= Fruit

TODO MAYBE MOVE THESE DETAILS TO THE 'ROUTES' DOCUMENTATION PAGE

Available endpoint options and their possible values:

| option 	|           values          		|      description      |
|:------:	|:-------------------------:		|:---------------------:|
| verb   	| get, post, put, delete 			| The HTTP Verb         |
| route  	| '/Fruit/:frid'            		| The HTTP Url to match |
| use    	| bool                 				| Your method will return an object for the Self Documenting API. |
| wrap   	| 'default_wrap', 'simple_wrap' 	| The Wrapper to use around custom route logic       |
| version  	| v1: this.logic, any: this.otherLogic     | Method to call based on API Version requested |
| sql_conn  | bool                 			| Grab a Sql Database Connection from the pool prior to invoking this method  |
| sql_tx  | bool                				| Start a Sql Transaction prior to calling this method  |
| auth_required  | bool                 		| Using OAuth 2.0 validate the token before calling this method (provide details)  |
| pre_load  | varName: this.preLoadLogic     		| Run this.preLoadLogic, put result in preload[ varName], pass preload to this method as second parm  |
NOTE: THERE ARE A FEW MORE CHOICES WITH THE LATEST WRAPPERS

### Custom Route Logic
Custom Route Logic is the logic that is to be run when DVblueprint and restify validate an incoming request and map it to a particular endpoint defined in a Route Module. The idea is to separate out the unique business logic for a particular route and simplify the logic in the process. Best practice is to define the custom route logic as a function within a Route Module and associate it with a particular endpoint by using the 'version' endpoint option in the Route Modules constructor.
TODO: IT WOULD BE SO MUCH NICER TO HAVE A VISUAL OF THIS - EVERYONE USES THESE "WORDS" IN MANY WAYS, SO IT IS HARD TO KNOW WHAT PART OF THE CODE IS BEING TALKED ABOUT

#### Versioning
Custom Route Logic is mapped to a URL, based on what was defined in the constructor. DVblueprint supports API Versioning by allowing you to specify different logic for different versions of the api. For example, when the server gets a request for 'POST /api/v1/Fruit', it will run the logic found in this.S_GetFruit. When the server gets a request for 'POST /api/v2/Fruit', it will run the logic found in this.S_GetFruit, and 'POST /api/v1/Fruit' calls this.S_GetFruitOld.

DVblueprint will first look for a specific version, otherwise, it will run the logic defined by the 'any:' key on the 'version' option of an endpoint.

#### Wrapping
Before custom route logic is run, it is wrapped with the logic defined in the 'wrap' option for the endpoint. The idea is that this wrapper can perform tedious, repetitive logic that is typically required across multiple different routes.

###### simple_wrap
The simple wrap will call the custom route logic the exact same way restify would, by passing in the incoming request object, response object, and the next callback. The simple_wrap does not perform any special post processing, so error handling, HTTP responses and calling next() are the responsibility of the route logic. The simple_wrap accepts the auth_required endpoint option to verify access to the endpoint.

	RouteUsingSimpleWrap: (req, res, next)->
		params= req.params
		if 'name' of params
			res.send "Hello, #{params.name}"
		else
			res.send new Error 'Missing the name param!'
		next()

###### default_wrap
The default wrap is a little smarter and can perform pre and post processing of the custom logic. The default wrapper will pass a Context (ctx) and some Pre Loaded variables (preLoaded) to the custom logic.  It is also responsible for 'catching' any errors and giving the client back a reasonable response as well as handling the COMMIT or ROLLBACK and return of the DB handle to the pool. For example, the 'default_wrap' can  validate a user's access token, grab a database connection, start a transaction, pre_load any data before calling the custom logic, handle any errors during route processing, roll-back a bad transaction, return the database connection to the pool, and respond appropriately to the incoming HTTP request. The wrapper also can limit max requests, validate roles against endpoints, and it logs requests that include the db handle number (for correlating cross-request issues), simultaneous connection metrics, the duration of the request, the error if there was one, auditing information, log filtering / cleaning, etc. On successfully running the custom logic, the wrapper will look at the return value for any data that needs to be sent back on the incoming request. There is also a 'guard' on returning from your logic back to the wrapper while the DB handle is still handling a request.

	RouteUsingDefaultWrap: (ctx, preLoaded)->
		const params= ctx.p 	         // Query params, form data, parsed req body
		const   conn= ctx.conn           // Sql Database connection
		const   _log= ctx.log            // Bunyan logger w/ req.id attached
		const authId= preLoaded.auth_id  // Authorized ident_id

		if (params.name == null) throw new this.E.MissingParam( 'name')
		return {send: {answer: `Hello, ${params.name}`}


###### Signatures and options
Here are the wraps that are currently available and the endpoint options that affect them:

| wrap 	|      wrapped logic signature 		| available options
|:------:	|:-------------------------:	| :--:
| simple_wrap   	| (req, res, next){} 		| auth_required
| auth_wrap			| (ctx){}					| (for authentication requests, alwasy a db transaction)
| default_wrap  	| (ctx, pre_loaded){}  		| sql_conn, sql_tx, auth_required, pre_load

#### Pre-load logic
Sometimes a route, or routes will need to run the same logic every single time. The biggest example of this would be to grab a record from the database based on an id passed in to the route. The default_wrapper has the ability to run any custom 'pre_load' logic, stash the result in to a variable and pass all of these variables to the custom route logic for further processing.

Using the 'eatFruit' endpoint from the example above, the return value of this function will be added to the pre_loaded variable passed in to the custom logic as 'fruit':

	// Preload the Fruit
	// Assumes 'Fruit/:frid' in the URL
	S_PlFruit: (ctx, preLoaded)->
		const f= 'Fruit:S_PlFruit:'
		// Typically you would not put a log line here, since the wrapper already logged the inbound ctx values
		const {fruitId: frid}= ctx.p
		let dbRows

		// Grab the Fruit from the database
		dbRows= await this.sdb.fruit.getById( ctx, fruitId)
		// Typically you would not put a log line here, since the query layer already logs the SQL, args, and sample response
		if (dbRows.length!== 1)	throw new this.E.NotFoundError( 'PRELOAD:FRUIT')
		return dbRows[0] // Wrapper places this result in the hash provided by this.endpoints

	S_EatFruit(ctx, preLoaded){ // Or (ctx, {fruit})
		...
		const {fruit}= preLoaded
		...
	}

#### Self-Documentation
To include a route in the Self-Documentation of the API, simply return a 'useDoc' if the first parameter to the custom route logic is the string 'use'. A 'use doc' is a Hash with 'params' and 'response', which in turn are key/value hashes of names and types that are to be included or returned. This strategy allows us to keep the documentation of this route as close as possible to the logic itself, giving us a better chance to keep these in sync.

	RouteUsingDefaultWrap(ctx, preLoaded) {
		const useDoc= {
			params: {
				intputOne: '{String} - a note can go here', // Note: This is informational only, your logic must process all params and check values/types
				otherThings: '{Number}'  // Note: non-string params would require post of JSON; you would convert from string to allow form post
			}
			response:{ success: 'bool', users: '{Array}'}
		}
		if (ctx=== 'use') return useDoc // The wrapper is calling us to acquire our documentation
	}

#### Complete Example
TODO ASK BILL IF HE PREVERS A CLASS WITH A PURAL OR NOT (FruitRoute vs FruitRoutes) is it one route with many endpoints or many routes, in this one class?
	class FruitRoutes {
		constructor(kit) {
			this.log= 		kit.services.logger.log
			this.config= 	kit.services.config
			this.sdb= 		kit.services.db.mysql
			this.E=			kit.services.error

			// Fruit Endpoints
			this.endpoints= {
				getFruit: {
					verb: 'get', route: '/Fruit'
					use: true, wrap: 'default_wrap', version: { any: @S_GetFruit }
					sql_conn: true, auth_required: false
				}
				eatFruit: {
					verb: 'del', route: '/Fruit/:frid/eat'
					use: true, wrap: 'default_wrap', version: { any: @S_EatFruit }
					sql_conn: true, sql_tx: true, auth_required: true
					pre_load: { fruit: @S_PlFruit }
				}
			}
		}

		// GET /Fruit

		S_GetFruit(ctx, preLoaded) {
			const useDoc= {
				params: {
				}
				response:{ success: 'bool', fruit: '{Array}'}
			}
			if (ctx=== 'use') return useDoc
			let dbRows
			const send= { success: true, fruit: []}

			# Grab all fruit from the database
			dbRows= await this.sdb.fruit.GetCollection( ctx)
			send.fruit= dbRows // This logic doesn't consider zero results as an issue (404 NotFound), so no check on dbRows.length here

			// Respond to the client
			return {send}
		}

		// POST /Fruit/:frid

		S_EatFruit(ctx, {dbFruit: fruit}) {
			const f= 'FruitRoute:S_EatFruit:'
			use_doc= {
				params: {}
				response: {success: 'bool'}
			}
			return use_doc if ctx is 'use'
			let dbResult
			const send= {success: true}

			// Dispose of the pre-loaded fruit
			dbResult= await this.sdb.fruit.DisposeById( ctx, dbFruit.id)
			if (dbResult.affectedRows!== 1) throw new this.E.DbError( `${f}fruitTable:dispose)

			// Respond to the client
			return {send}
		}


		// Preload the Fruit /Fruit/:frid
		S_PlFruit(ctx, pre_loaded) {
			const f= 'FruitRoute:S_PlFruit:'
			const {frid}= ctx.p

			// Grab the Fruit from the database
			dbRows= await this.sdb.fruit.getById( ctx, frid)
			if (dbRows.length!== 1) throw new this.E.NotFoundError( `${f}fruitTable`)
			return dbRows[0] // Give a single row to the wrapper
		}

	exports.FruitRoutes= FruitRoutes
	TOOD MAYBE module.exports= {FruitRoutes}

## TODO

Documentation:

* Document how to create a Service and where to access
* Document how to create a MySql Module
* Document Default Config File

Features:

* Authenticate Long-Poll Handles
* Server Analytics Endpoint
* Testing Framework using Mocha + Chai
* Integrate Grunt
* Event Logging
* Agnostic Database Interface
* Agnostic Email Interface
* SSL
* Param Validator
* Cron Job Processor (Now exists as RunQ !!)
* Re-design Role Manager (Roles, ACLS, Permits) (Started see lib/role_manager)


## License
Copyright © Dev IQ, Inc 2014 - 2022. All Rights Reserved. [deviq.io](https://www.deviq.io)
