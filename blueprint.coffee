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
{Db}=			require  './lib/db'
{Kit}=			require  './lib/kit'
s_use=			require	 './lib/server_use'
config= 		(require './lib/config')()
{Logger}=		require  './lib/logger'
{Wrapper}=		require  './lib/route_wrapper'
{TokenMgr}=		require  './lib/token_manager'
{PreLoader}= 	require  './lib/pre_loader'
{AuthParser}=	require  './lib/authorizationParser'

# Route Logic
{User}=			require './routes/r_user'
{Workout}=		require './routes/r_workout'
{AuthRoute}=	require './routes/r_auth'

# Create Kit
kit= new Kit

# Add Library Services to Kit
kit.add_service 'config', 		config		# Config Object
kit.new_service 'logger', 		Logger		# Bunyan Logger
kit.new_service 'tokenMgr', 	TokenMgr	# Token Manager
kit.new_service 'db', 			Db			# Database Object (MySQL, MongoDB)
kit.new_service 'pre_loader', 	PreLoader	# Route Pre Loader
kit.new_service 'wrapper', 		Wrapper		# Route Wrapper
kit.new_service 'authParser', 	AuthParser	# Request Authorization Parser

# Add Route Services to Kit
kit.new_route_service 'auth', 		AuthRoute	# Authentication Route Logic
kit.new_route_service 'user', 		User		# User Route Logic
kit.new_route_service 'workout', 	Workout		# Workout Route Logic

# Create Server
restify= require 'restify'
log= kit.services.logger.log
server= restify.createServer
	log: kit.services.logger.log

# Setup Handlers
server.use s_use.set_response_headers
server.use restify.queryParser()
server.use restify.bodyParser()
server.use restify.requestLogger()
server.use kit.services.authParser.parseAuthorization
server.use s_use.debug_request

# Auth Routes
server.post '/Auth',		kit.routes.auth.authenticate

# User Routes
server.get	'/User/:usid',	kit.routes.user.get
server.post '/User',		kit.routes.user.createUser

# Workout Routes
server.get	'/Workout',		kit.routes.workout.get
server.post	'/Workout',		kit.routes.workout.createWorkout

# Start the Server
server.listen config.api.port, ()->
	log.info 'Server listening at', server.url