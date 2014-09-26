# DVblueprint

## About

DVblueprint is an out of the box Node.js REST server.  
	
**Features**:  

* Easily Extensible REST Interface  
* Built-in support for MySql and MongoDb  
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

##### Install CoffeeScript
Most of the DVblueprint server is written in [CoffeeScript](http://coffeescript.org). It is syntactic sugar for JavaScript, and it is much easier to read and develop with. All of the examples below are going to be CoffeeScript. Node runs on JavaScript, so all Coffee files must be compiled before run time.  

	npm install -g coffee-script
	
Compile a .coffee file using the '-c' flag:
	
	coffee -c my_file.coffee

##### Install MySql
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
	$ npm instal

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
	$ npm instal bunyan
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

## TODO

Documentation:

* Document how to create a Route
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
Copyright © DV-mobile 2014. All Rights Reserved.