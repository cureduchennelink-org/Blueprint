#
#	Server Initialization
#

# Require Node Modules
M= 			require 'moment'
Q= 			require 'q'
restify= 	require 'restify'
_= 			require 'lodash'

# Set default format for moment
M.defaultFormat= 'YYYY-MM-DD HH:mm:ss'

# Library Modules and Services
{Kit}=		require  './lib/kit'
config= 	(require './lib/config')()
{Logger}=	require  './lib/logger'

# Initialize kit and set up with core services (config, logger, socket.io)
kit= new Kit
kit.add_service 'config', 		config					# Config Object
kit.new_service 'logger', 		Logger					# Bunyan Logger

log= 	kit.services.logger.log
server= restify.createServer log: log 	# Create Server
kit.add_service 'server', server 		# Add server to kit

# Services
for nm, mod of kit.services.config.service_modules when mod.enable is true
	log.info "Initializing #{mod.class} Service..."
	opts= if mod.instConfig then [mod.instConfig] else null
	kit.new_service mod.name, (require mod.file)[mod.class], opts

# Restify Hanlders
for handler in config.restify.handlers
	server.use restify[handler]()

# Service Handlers
for nm, service of kit.services when typeof service.server_use is 'function'
	server.use service.server_use

# Parse JSON param
server.use (req, res, next)->
	if "JSON" of req.params
		_.merge req.params, JSON.parse req.params.JSON
	next()

# Strip all <> from params
server.use (req, res, next)->
	for param of req.params
		if req.params[param] isnt null and _.isString(req.params[param])
			req.params[param]= req.params[param].replace /[<>]/g, "-"
	next()

# Routes
for nm,mod of kit.services.config.route_modules when mod.enable is true
	log.info "Initializing #{mod.class} Routes..."
	kit.new_route_service mod.name, (require mod.file)[mod.class]
	kit.services.wrapper.add mod.name

# Run Server Init Functions from Kit Service Modules
q_result= Q.resolve()
for nm, service of kit.services when typeof service.server_init is 'function'
	do(service)-> q_result= q_result.then -> service.server_init(kit)

# Run Server Init Functions from Kit Route Modules
for nm, route of kit.routes when typeof route.server_init is 'function'
	do(route)-> q_result= q_result.then -> route.server_init(kit)

# Start the Server
q_result.then ->
	# Static File Server (Must be last Route Created)
	server.get /.*/, restify.serveStatic config.api.static_file_server
	# Listen
	server.listen config.api.port, ()->
		log.info 'Server listening at', server.url

.fail (err)->
	log.error err
	log.error 'SERVER FAILED TO INITIALIZE. EXITING NOW!'
	process.exit(1)
