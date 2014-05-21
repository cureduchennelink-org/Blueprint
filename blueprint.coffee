#
#	Blueprint - Template Node Server
#
#	Written for DV-Mobile by Jamie Hollowell. All rights reserved.
#

# Node Modules
Q= 			require 'q'
restify= 	require 'restify'
socketio=	require 'socket.io'

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
io= 	socketio.listen server 			# Create Web Socket Listener
io.set 'log level', 2					# Set socket.io output to info level
kit.add_service 'server', server 		# Add server to kit
kit.add_service 'io', io 				# Add socket io to kit

# Services
for mod in kit.services.config.service_modules when mod.enable is true
	opts= if mod.instConfig then [mod.instConfig] else null
	kit.new_service mod.name, (require mod.file)[mod.class], opts

# Routes
for mod in kit.services.config.route_modules when mod.enable is true
	log.info "Initializing #{mod.class} Routes..."
	kit.new_route_service mod.name, (require mod.file)[mod.class]
	kit.services.wrapper.add mod.name

# Restify Hanlders
for handler in config.restify.handlers
	server.use restify[handler]()

# Service Handlers
for nm, service of kit.services when typeof service.server_use is 'function'
	server.use service.server_use

# Run Server Init Functions from Kit Service Modules
q_result= Q.resolve()
for nm, service of kit.services when typeof service.server_init is 'function'
	do(service)-> q_result= q_result.then -> service.server_init(kit)

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
