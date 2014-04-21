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


# Library Modules and Services
{Kit}=			require  './lib/kit'
{Db}=			require  './lib/db'
s_use=			require	 './lib/server_use'
config= 		(require './lib/config')()
{Logger}=		require  './lib/logger'
{Wrapper}=		require  './lib/route_wrapper'
{TokenMgr}=		require  './lib/token_manager'
{AuthParser}=	require  './lib/authorizationParser'

# Route Logic
{User}=			require './routes/r_user'
{Workout}=		require './routes/r_workout'
{AuthRoute}=	require './routes/r_auth'

# Create Kit
kit= new Kit

# Add Library Services to Kit
kit.add_service 'config', 		config					# Config Object
kit.new_service 'logger', 		Logger					# Bunyan Logger
kit.new_service 'tokenMgr', 	TokenMgr				# Token Manager
kit.new_service 'db', 			Db						# Database Object (MySQL, MongoDB)
kit.new_service 'authParser', 	AuthParser				# Request Authorization Parser
kit.new_service 'wrapper', 		Wrapper, [kit.routes]	# Route Wrapper

# Add Route Services to Kit
kit.new_route_service 'auth', 		AuthRoute	# Authentication Route Logic
kit.new_route_service 'user', 		User		# User Route Logic
kit.new_route_service 'workout', 	Workout		# Workout Route Logic

# Create Server
restify= require 'restify'
log= kit.services.logger.log
server= restify.createServer
	log: log

# Setup Handlers
server.use s_use.set_response_headers
server.use restify.queryParser()
server.use restify.bodyParser()
server.use restify.requestLogger()
server.use kit.services.authParser.parseAuthorization
server.use s_use.debug_request

usage= {}
alt_wrappers= {} # Example: user: kit.services.user_wrapper
pfx= config.route_prefix.api

add_route= (verb, route, mod, func)->
	wrap= (alt_wrappers[mod] ? kit.services.wrapper).add mod, func
	usage[mod]= {} unless usage[mod]
	usage[mod][func]= {} unless usage[mod][func]
	usage[mod][func][route]= wrap 'use'
	verbs= [verb]
	verbs.push 'post' if verb in ['del','put']
	server[cmd] pfx + '' + route, wrap for cmd in verbs

# Auth Routes
add_route 'post', 	'/Auth', 			'auth', 'authenticate'

# User Routes
add_route 'post', 	'/User', 			'user', 'create'
#add_route 'put', 	'/User/:usid', 		'user', 'update'
add_route 'get', 	'/User/:usid', 		'user', 'get'

# Workout Routes
add_route 'post', 	'/Workout', 		'workout', 'create'
add_route 'get', 	'/Workout', 		'workout', 'get'

# API Usage
server.get pfx, (q,r,n)-> r.send usage; n()

# Static File Server
server.get /.*/, restify.serveStatic
	directory: './html_root',
	default: 'index.html'

# Start the Server
server.listen config.api.port, ()->
	log.info 'Server listening at', server.url