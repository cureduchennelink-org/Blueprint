#
#	Blueprint - Template Node Server
#	- Restify 2.6.0
#	- MySql 2.0.0-alpha9
# 	- MongoDB (Mongoose ~3.8.7)
#	- Logging with Bunyan
#	- CoffeeScript
#
#	TODO:
#		Launch Script
#			- Output log levels to separate files
#		OAuth 2.0
#		SSL Configuration
#		Server Stats / Analytics
#
#	Written for DV-Mobile by Jamie Hollowell. All rights reserved.
#
#

restify= 	require 'restify'
bunyan= 	require 'bunyan'
config= 	(require './lib/config')()

# Logger
log= bunyan.createLogger config.log

# Token Manager
{TokenMgr}=		require './lib/token_manager'
tokenMgr= 		new TokenMgr log

# Database Objects
{Db}=	require './lib/db'
db=		new Db config.db, tokenMgr, log

# Route PreLoader
{PreLoader}= 	require './lib/pre_loader'
pre_loader= 	new PreLoader db, log

# Route Wrappers
{Wrapper}=		require './lib/route_wrapper'
wrapper= 		new Wrapper db, pre_loader, log

# Authorization Parser
{AuthParser}=	require './lib/authorizationParser'
authParser=		new AuthParser config.auth, tokenMgr, log

# Route Logic
ping= require './routes/ping'
{User}= require './routes/r_user'
{Workout}= require './routes/r_workout'
{AuthRoute}= require './routes/r_auth'

user= 		new User db, wrapper, log
workout= 	new Workout db, wrapper, log
auth= 		new AuthRoute config.auth, tokenMgr, db, wrapper, log

# Create Server
server= restify.createServer
	log: log

# Setup Handlers
server.use (req, res, next) ->
	res.setHeader 'Access-Control-Allow-Credentials', 'true'
	res.setHeader 'Access-Control-Allow-Origin',( req.headers.origin || '*')
	return next()

server.use restify.queryParser()
server.use restify.bodyParser()
server.use restify.requestLogger()
server.use authParser.parseAuthorization

# Debug Line
server.use (req, res, next) ->
	req.log.info 'ROUTE:', req.url, req.method
	req.log.info 'PARAM:', req.params[p] for p of req.params
	return next()

# Setup Routes
server.get	'/ping/:name',	ping

server.post '/Auth',		auth.authenticate
server.get	'/User/:usid',	user.get
server.post '/User',		user.createUser
server.get	'/Workout',		workout.get
server.post	'/Workout',		workout.createWorkout

# Start the Server
server.listen config.api.port, ()->
	log.info 'Server listening at', server.url