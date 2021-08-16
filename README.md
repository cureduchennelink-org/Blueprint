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

# Quick Start
The main application is its own directory which can be a repository. DVblueprint is going to be a package.json dependency.
Any subdirectories are your option. As the project grows you'll want routes and services and db mods in their own dir.
The following commands will setup a simplified project directory to run an application that
uses the DVblueprint server.

	$ cd my/workspace/directory
	$ mkdir my_app
	$ cd my_app
	$ npm init
	$ mkdir src
	$ touch src/app.js src/container.js

#### Reference DVblueprint in your package.json
Add a "dependencies" section of package.json, with this git url.
Note: DVblueprint is a publicly available bitbucket repo.

	 "dependencies": {
		"blueprint": "git+https://git@bitbucket.org/dv-mobile/blueprint.git#latest"
	 }

#### Create the Main Application File
Add the following to the main application file (src/app.js):

	//
	// app.js: Main launch point for the application
	//
	const blueprint= require( "blueprint")

	// Lists of modules to include on start-up
	const services= []
	const routes= []

	const kit= await blueprint.init({ listen: true, services, routes})
	const port= kit.services.config.api.port

	console.log( 'API server is ready.', ` http://localhost:${port}/api/v1`)

#### Global depedencies
Logging is enhanced with bunyan, so using it to read the logs is preferable

	$ sudo npm install bunyan -g

#### Running
To run the application:

	$ node src/app.js | bunyan -o short

Vist the REST API Documentation: [http://localhost:9500/api/v1](http://localhost:9500/api/v1)
(TODO) Vist the Example Todo Web-App: [http://localhost:9500/](http://localhost:9500/)

## You did it!

# Add your own route logic
Let's create a custom route module with two endpoints. You will need to create a file with a class in it, then tell DVblueprint where to find it, and finally update the main application to expose this route.

### Create a route module
In this example, we will create a 'FruitRoute' class and module to expose 'get fruit' and 'eat fruit' endpoints. Edit a file called src/r_fruit.js

	//
	// Fruit route endpoints
	//
	class FruitRoute {
		constructor(kit) {
			this.E= kit.services.error // Common error types

			this.fruitBasket= {
				orange: 5,
				banana: 2,
				peach: 6,
			}

			// Fruit Endpoints
			this.endpoints= {
				getFruit: {
					verb: 'get',
					route: '/Fruit',
					use: true,
					wrap: 'default_wrap',
					version: { any: this.S_GetFruit.bind( this) }
				}
				eatFruit: {
					verb: 'del',
					route: '/Fruit/:frid/eat',
					use: true,
					wrap: 'default_wrap',
					version: { any: this.S_EatFruit.bind( this) }
				}
			}
		}

		// GET /Fruit

		S_GetFruit(ctx, preLoaded) {
			const useDoc= {
				params: {
				}
				response:{ success: 'bool', fruit: '{Object}'}
			}
			if (ctx=== 'use') return useDoc
			let dbRows
			const send= { success: true, fruit: []}

			// Grab all fruit from the "database"
			send.fruit= Object.assign( {}, this.fruitBasket)

			// Respond to the client
			return {send}
		}

		// POST /Fruit/:frid

		S_EatFruit(ctx) {
			const f= 'FruitRoute:S_EatFruit:'
			use_doc= {
				params: {}
				response: {success: 'bool'}
			}
			return use_doc if ctx is 'use'
			const send= {success: true}
			const {frid: fruitId}= ctx.p // Pull in the param

			// Dispose of the pre-loaded fruit (confirm we have/had fruit to eat)
			if (this.fruitBasket[ fruitId] == null) throw new this.E.NotFound( `${f}fruitTable:dispose`)
			if (--this.fruitBasket[ fruitId] === 0) delete this.fruitBasket[ fruitId]

			// Respond to the client
			return {send}
		}

	exports.FruitRoute= FruitRoute

### Tell DVblueprint where to find the Route Module
Add the following to the application's config file so DVblueprint can find the Route Module:

	// container.js
	module.exports= {
		route_modules: {
			FruitRoute: {
				file: 'src/r_fruit',
			}
		}
	}

### Update the start-up script to request this route-module be exposed in the API
In src/app.js, change this line

	const routes= []

to

	const routes= [ 'FruitRoute']

## See the results
Restart the server.

### Updated documentation
 Notice the new documented route (click on the left side, 'FruitRoute') [http://localhost:9500/api/v1](API documentation.)
 
### Access the 'get' endpoint
Check on fruit inventory: [http://localhost:9500/api/v1/Fruit](Fruit inventory) - consider using JSON-view to see JSON results nicely formatted in your browser.
  
### Access the 'post'endpoint
Use POSTMAN or Curl to eat some of that fruit:

	curl http://localhost:9500/api/v1/Fruit/orange/eat

### Access the 'get' endpoint (again)

Reload your browser tab to see the updated fruit inventory.

## You Did it Again!


# TODO

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
