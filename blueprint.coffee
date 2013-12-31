#
#	Blueprint - Template Node Server
#	- Restify 2.6.0
#	- MySql 2.0.0-alpha9
#	- Logging with Bunyan
#	- CoffeeScript
#	
#	TODO:
#		OAuth 2.0
#		SSL Configuration
#		Server Stats
#		Domain Error Handling
#
#	Written for DV-Mobile by Jamie Hollowell. All rights reserved.
#
#

restify= 	require 'restify'
bunyan= 	require 'bunyan'
config= 	(require './lib/config')()

# Create Logger
log= bunyan.createLogger config.log

# Create Database Objects
{Db}=	require './lib/db'
db= new Db config.db, log

# Library Modules
{PreLoader}= 	require './lib/pre_loader'
pre_loader= 	new PreLoader db, log

{Wrapper}=		require './lib/route_wrapper'
wrapper= 		new Wrapper db, pre_loader, log

# Route Logic
ping= require './routes/ping'
{User}= require './routes/user'
user= new User db, wrapper, log

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

# Debug Line
server.use (req, res, next) ->
	req.log.info 'ROUTE:', req.url, req.method
	req.log.info 'PARAMS:', req.params
	return next()
	
# Setup Routes
server.get	'/ping/:name',	ping
server.get	'/User/:usid',	user.get
server.post	'/User',		user.createUser

# Start the Server
server.listen config.api.port, ()->
	log.info 'Server listening at', server.url