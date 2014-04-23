#
#	Blueprint - Template Node Server
#	- Restify 2.6.0
#	- MySql 2.0.0-alpha9
# 	- MongoDB (Mongoose ~3.8.7)
#	- Logging with Bunyan
#	- CoffeeScript
#	- OAuth 2.0
#
#	TODO:
#		Launch Script
#			- Output log levels to separate files
#		SSL Configuration
#		Server Stats / Analytics
#
#	Written for DV-Mobile by Jamie Hollowell. All rights reserved.
#
#

restify= require 'restify'

# Library Modules and Services
{Kit}=			require  './lib/kit'
{Db}=			require  './lib/db'
s_use=			require	 './lib/server_use'
config= 		(require './lib/config')()
{Logger}=		require  './lib/logger'
{Router}=		require  './lib/router'
{Wrapper}=		require  './lib/route_wrapper'
{TokenMgr}=		require  './lib/token_manager'
{AuthParser}=	require  './lib/authorizationParser'

# Initialize kit and set up with core services
kit= new Kit
kit.add_service 'config', 		config					# Config Object
kit.new_service 'logger', 		Logger					# Bunyan Logger

# Create Server and add to Kit
log= kit.services.logger.log
server= restify.createServer log: log
kit.add_service 'server', server

# Add additional Library Services to Kit
# TODO: Move these to the config file just like the route modules
kit.new_service 'tokenMgr', 	TokenMgr				# Token Manager
kit.new_service 'db', 			Db						# Database Object (MySQL, MongoDB)
kit.new_service 'authParser', 	AuthParser				# Request Authorization Parser
kit.new_service 'router',		Router					# Route Creator
kit.new_service 'wrapper', 		Wrapper					# Route Wrapper

# Setup Handlers
server.use s_use.set_response_headers
server.use restify.queryParser()
server.use restify.bodyParser()
server.use restify.requestLogger()
server.use kit.services.authParser.parseAuthorization
server.use s_use.debug_request

# Create all Routes
for mod in kit.services.config.route_modules when mod.enable is true
	kit.new_route_service mod.name, (require mod.file)[mod.class]
	kit.services.wrapper.add mod.name

# API Usage Endpoint
kit.services.router.route_usage()

# Static File Server
server.get /.*/, restify.serveStatic
	directory: './html_root',
	default: 'index.html'

# Start the Server
server.listen config.api.port, ()->
	log.info 'Server listening at', server.url