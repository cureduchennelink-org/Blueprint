# DVblueprint

## About

DVblueprint is an out of the box Node.js REST server.

**Features**:

* Easily Extensible REST Interface
* Built-in support for MySql, MongoDb, & Postgres
* OAuth 2.0 Authentication Protocol
* User Signup / Registration
* Forgot Password Flow
* Rapid Route Prototyping
* Dynamic Data using Long-Polling
* Route Error Handling
* Email Templating
* AWS SES and S3 Integration
* Static File Server (Web Server)
* Easy Logging using Bunyan
* Self-Documenting API

## Install Environment Dependencies
##### Install Node
The latest version of Node.js can be downloaded and isntalled from here: [download node](http://nodejs.org/download). To learn more, you can read the documentation here: [node.js docs](http://nodejs.org/documentation/)
\
##### Install MySql or Postgres

Some of the features in DVblueprint require a MySql database, including Dynamic Push Data,
and OAuth 2.0 Authentication. Access to a MySql server needs to be set up.

Here are some options to help get you started:

* [Amazon's RDS](http://aws.amazon.com/rds/)
* [MAMP for Mac OS X](http://www.mamp.info/en/)

## Install DVblueprint

##### Clone DVblueprint from bitbucket
Clone the repository to your local workspace directory and install node dependencies.

	$ cd my/workspace/directory
	$ git clone https://bitbucket.org/dv-mobile/blueprint.git
	$ cd blueprint
	$ npm install

## Initialize Database

	$ cd my/workspace/directory/blueprint
	$ mysql -u [username] -h [optioanl-db-host] -p

	mysql> CREATE DATABASE blueprint
		-> DEFAULT CHARACTER SET utf8
		-> DEFAULT COLLATE utf8_general_ci;

	mysql> use blueprint;
	mysql> source db/bootstrap.sql;
	mysql> exit


## Create Application Directory
The main application is going to live as a peer of the DVblueprint repository.
The following commands will setup an ideal project directory to run an application that
uses the DVblueprint server.

	$ cd my/workspace/directory
	$ mkdir my_app
	$ cd my_app
	$ sudo npm install -g bunyan
	$ ln -s ../blueprint ./node_modules/.
	$ ln -s ../blueprint/html_root .
	$ mkdir lib
	$ mkdir routes
	$ mkdir config

## Configure the Application
##### Configuration Files
When the Blueprint server first launches, it will load default configuration details
and merge it with the config file that matches the running processes enviroment.

Create a local config file using the editor of your choice (Make sure to compile after editing):

	$ cd my/workspace/directory/my_app
	$ vi config/local_dev.coffee

##### Configure Database

 	# local_dev.coffee
	module.exports=
		db:
			mysql:
				pool:
					host: 'localhost'
					port: 8889 	# MAMP uses this port number
					user: 'root'
					password: 'root'
					database: 'blueprint'


## Create Server File
Create main application file

	$ cd my/workspace/directory/my_app
	$ vi server.coffee

Add the following to the main application file:

	#
	# server.coffee: Main launch point for the application
	#

	server= require 'blueprint'
	server.start()


## Running
To run the application:

	$ export npm_config_env="local_dev"
	$ export npm_config_config_dir="config"
	$ node server.js | bunyan -o short

Vist the REST API Documentation: [here](http://localhost:9500/api/v1)
Vist the Example Todo Web-App: [here](http://localhost:9500/)

## Creating Custom Routes
The following is an example of how to add a route module that exposes endpoints for 'Fruit' resources.
### Create Route Module File
Create a Route Module within the application's *routes* directory using the editor of your choice:

	$ cd my/workspace/directory/my_app
	$ vi routes/r_fruit.coffee

### Install Route Module
Add the following to the application's config file to install the Route Module:

	# local_dev.coffee
	module.exports=
		db:
			...
		route_modules:
			Fruit:
				enable: true
				name: 'Fruit'
				class: 'Fruit'
				file: 'routes/r_fruit'

### Route Module Constructor
An instance of the Route Module will be created when the server is first fired up, and all endpoints defined in the module will be registered with Restify to be exposed over the API. The constructor will be passed the kit, which has access to all enabled services including the app config, and application logger (See creating a Custom Service). Best practice is to take what you need from the kit and attach to ***this (@)***.

Endpoints are defined by adding to the ***@endpoints*** variable of the module, and defining options for that endpoint.

	class Fruit
		constructor: (kit)->
			@log= 		kit.services.logger.log
			@config= 	kit.services.config
			@sdb= 		kit.services.db.mysql

			# Fruit Endpoints
			@endpoints=
				getFruit:
					verb: 'get', route: '/Fruit'
					use: true, wrap: 'default_wrap', version: any: @S_GetFruit
					sql_conn: true, auth_required: false
				buyFruit:
					verb: 'post', route: '/Fruit'
					use: true, wrap: 'default_wrap', version: v1: @S_BuyFruit, v2: @S_BuyFruit2
					sql_conn: true, sql_tx: true, auth_required: true
				eatFruit:
					verb: 'del', route: '/Fruit/:frid/eat'
					use: true, wrap: 'default_wrap', version: any: @S_EatFruit
					sql_conn: true, sql_tx: true, auth_required: true
					pre_load: fruit: @S_PlFruit

		S_GetFruit: (ctx, pre_loaded)-> ...
		S_BuyFruit: (ctx, pre_loaded)-> ...
		S_BuyFruit2: (ctx, pre_loaded)-> ...
		S_EatFruit: (ctx, pre_loaded)->	 ...
		S_PlFruit: (ctx, pre_loaded)-> ...
	exports.Fruit= Fruit

Available endpoint options and their possible values:

| option 	|           values          		|      description      |
|:------:	|:-------------------------:		|:---------------------:|
| verb   	| get, post, put, delete 			| The HTTP Verb         |
| route  	| '/Fruit/:frid'            		| The HTTP Url to match |
| use    	| bool                 				| Use the Self Documenting API. |
| wrap   	| 'default_wrap', 'simple_wrap' 	| The Wrapper to use around custom route logic       |
| version  	| v1: @logic, any: @otherLogic     | Custom Logic to Use based on API Version requested |
| sql_conn  | bool                 			| Grab a Sql Database Connection  |
| sql_tx  | bool                				| Start a Sql Transaction  |
| auth_required  | bool                 		| Use OAuth 2.0 for this route  |
| pre_load  | varName: @preLoadLogic     		| Run @preLoadLogic and stuff return value in to varName  |

### Custom Route Logic
Custom Route Logic is the logic that is to be run when DVblueprint and restify validate an incoming request and map it to a particular endpoint defined in a Route Module. The idea is to separate out the unique business logic for a particular route and simplify the logic in the process. Best practice is to define the custom route logic as a function within a Route Module and associate it with a particular endpoint by using the 'version' endpoint option in the Route Modules constructor.

#### Versioning
Custom Route Logic is mapped to a URL, based on what was defined in the constructor. DVblueprint supports API Versioning by allowing you to specify different logic for different versions of the api. For example, when the server gets a request for 'POST /api/v1/Fruit', it will run the logic found in @S_GetFruit. When the server gets a request for 'POST /api/v2/Fruit', it will run the logic found in @S_GetFruit2.

DVblueprint will first look for a specific version, otherwise, it will run the logic defined by the 'any:' key on the 'version' option of an endpoint.

#### Wrapping
Before custom route logic is run, it is wrapped with the logic defined in the 'wrap' option for the endpoint. The idea is that this wrapper can perform tedious, repetitive logic that is typically required across multiple different routes. For example, the 'default_wrap' can grab a database connection, start a transaction, verify authentication, pre_load any data before calling the custom logic, handle any errors during route processing, roll-back a bad transaction, return the database connection to the pool, and even respond back to the incoming HTTP request.

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
The default wrap is a little smarter and can perform pre and post processing of the custom logic. The default wrapper will pass a Context (ctx) and some Pre Loaded variables (pre_loaded) to the custom logic. The default wrapper will catch any errors that are thrown in the custom logic, and then on successfully running the custom logic, the wrapper will look at the return value for any data that needs to be sent back on to incoming request.

	RouteUsingDefaultWrap: (ctx, pre_loaded)->
		params= ctx.p 	 # Query params, form data, parsed req body
		conn=	ctx.conn # Mysql Database connection
		_log= 	ctx.log  # Bunyan logger w/ req.id attached
		authId= pre_loaded.auth_id # Authorized ident_id

		throw new E.MissingParam 'name' unless 'name' of params
		send: "Hello, #{params.name}"


###### Signatures and options
Here are the wraps that are currently available and the endpoint options that affect them:

| wrap 	|      wrapped logic signature 		| available options
|:------:	|:-------------------------:	| :--:
| simple_wrap   	| (req, res, next)-> 		| auth_required
| default_wrap  	| (ctx, pre_loaded)->  		| sql_conn, sql_tx, auth_required, pre_load

#### Pre-load logic
Sometimes a route, or routes will need to run the same logic every single time. The biggest example of this would be to grab a record from the database based on an id passed in to the route. The default_wrapper has the ability to run any custom 'pre_load' logic, stash the result in to a variable and pass all of these variables to the custom route logic for further processing.

Using the 'eatFruit' endpoint from the example above, the return value of this function will be added to the pre_loaded variable passed in to the custom logic as 'fruit':

	# Preload the Fruit
	# Assumes 'Fruit/:frid' in the URL
	S_PlFruit: (ctx, pre_loaded)->
		f= 'Auth:S_PlFruit:'
		fruit_id= ctx.p.frid

		Q.resolve()
		.then ()=>

			# Grab the Fruit from the database
			@sdb.fruit.get_by_id ctx, fruit_id
		.then (db_rows)=>
			throw new E.NotFoundError 'PRELOAD:FRUIT' if db_rows.length isnt 1
			return db_rows[0]

	S_EatFruit: (ctx, pre_loaded)->
		...
		fruit= pre_loaded.fruit
		...

#### Self-Documentation
To include a route in the Self-Documentation of the API, simply return a 'use_doc' if the first parameter to the custom route logic is the string 'use'. A 'use_doc' is a Hash with 'params' and 'response', which in turn are key/value hashes of names and types that are to be included or returned.

	RouteUsingDefaultWrap: (ctx, pre_loaded)->
		use_doc=
			params: {}
			response: success: 'bool', users: '[]'
		return use_doc if ctx is 'use'

	RouteUsingSimpleWrap: (req, res, next)->
		use_doc=
			params: state:'S', country: 'S'
			response: profile: '{}'
		return use_doc if req is 'use'

#### Complete Example

	class Fruit
		constructor: (kit)->
			@log= 		kit.services.logger.log
			@config= 	kit.services.config
			@sdb= 		kit.services.db.mysql
			@E=			kit.services.error

			# Fruit Endpoints
			@endpoints=
				getFruit:
					verb: 'get', route: '/Fruit'
					use: true, wrap: 'default_wrap', version: any: @S_GetFruit
					sql_conn: true, auth_required: false
				eatFruit:
					verb: 'del', route: '/Fruit/:frid/eat'
					use: true, wrap: 'default_wrap', version: any: @S_EatFruit
					sql_conn: true, sql_tx: true, auth_required: true
					pre_load: fruit: @S_PlFruit

		S_GetFruit: (ctx, pre_loaded)->
			use_doc=
				params: {}
				response: success: 'bool', fruit: '[]'
			return use_doc if ctx is 'use'
			fruit= []

			Q.resolve()
			.then ()=>

				# Grab all fruit from the database
				@sdb.fruit.GetCollection ctx
			.then (db_rows)=>
				fruit= db_rows

				# Respond to the client
				success= true
				send: {success, fruit}

		S_EatFruit: (ctx, pre_loaded)->
			use_doc=
				params: {}
				response: success: 'bool', fruit: '[]'
			return use_doc if ctx is 'use'

			Q.resolve()
			.then ()=>

				# Dispose of the pre-loaded fruit
				@sdb.fruit.DisposeById ctx, pre_loaded.fruit.id
			.then (db_result)=>
				throw new @E.DbError 'Unable to Eat Fruit' unless db_result.affectedRows is 1

				# Respond to the client
				success= true
				send: {success}


		# Preload the Fruit
		# Assumes 'Fruit/:frid' in the URL
		S_PlFruit: (ctx, pre_loaded)->

			Q.resolve()
			.then ()=>

				# Grab the Fruit from the database
				@sdb.fruit.get_by_id ctx, ctx.p.frid
			.then (db_rows)=>
				throw new E.NotFoundError 'PRELOAD:FRUIT' if db_rows.length isnt 1
				return db_rows[0]

	exports.Fruit= Fruit

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
* Cron Job Processor
* Re-design Role Manager (Roles, ACLS, Permits)


## License
Copyright © DVmobile 2014 - 2018. All Rights Reserved. [dvmobile.io](http://www.dvmobile.io)
