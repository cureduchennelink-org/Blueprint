#
#	Server Initialization
#

exports.start= ()->
	# Require Node Modules
	M= 			require 'moment'
	Q= 			require 'q'
	restify= 	require 'restify'
	_= 			require 'lodash'
	path= 		require 'path'

	# Set default format for moment
	M.defaultFormat= 'YYYY-MM-DD HH:mm:ss'

	# Library Modules and Services
	{Kit}=		require  './lib/kit'
	config= 	(require './config')()
	{Logger}=	require  './lib/logger'
	Error= 		require  './lib/error'

	# Initialize kit and set up with core services (config, logger, error)
	kit= new Kit
	kit.add_service 'config', 		config					# Config Object
	kit.new_service 'logger', 		Logger					# Bunyan Logger
	kit.add_service 'error', 		Error					# Error Objects

	log= 	kit.services.logger.log
	server= restify.createServer log: log 	# Create Server
	kit.add_service 'server', server 		# Add server to kit

	# Services
	for nm, mod of kit.services.config.service_modules when mod.enable is true
		log.info "Initializing #{mod.class} Service..."
		opts= if mod.instConfig then [mod.instConfig] else null
		servicePath= path.join config.processDir, mod.file
		kit.new_service mod.name, (require servicePath)[mod.class], opts

	# Restify Hanlders
	for handler in config.restify.handlers
		log.info "(restify handler) Server.use #{handler}", config.restify[ handler]
		server.use restify[handler] config.restify[ handler]
	# Handle all OPTIONS requests to a deadend (Allows CORS to work them out)
	log.info "(restify) Server.opts", config.restify.allow_headers
	server.opts /.*/, ( req, res ) =>
		res.setHeader 'access-control-allow-headers', (config.restify.allow_headers ? []).join ', '
		res.send 204

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
				req.params[param]= req.params[param].replace /[<>]/g, ""
		next()

	# Routes
	for nm,mod of kit.services.config.route_modules when mod.enable is true
		log.info "Initializing #{mod.class} Routes..."
		routePath= path.join config.processDir, mod.file
		kit.new_route_service mod.name, (require routePath)[mod.class]
		kit.services.wrapper.add mod.name

	# Run Server Init Functions from Kit Service Modules
	q_result= Q.resolve()
	for nm, service of kit.services when typeof service.server_init is 'function'
		do(service)-> q_result= q_result.then -> service.server_init(kit)

	# Run Server Init Functions from Kit Route Modules
	for nm, route of kit.routes when typeof route.server_init is 'function'
		do(route)-> q_result= q_result.then -> route.server_init(kit)

	# Run Server Start Functions from Kit Service Modules
	for nm, service of kit.services when typeof service.server_start is 'function'
		do(service)-> q_result= q_result.then -> service.server_start(kit)

	# Start the Server
	q_result.then ->
		# Static File Server (Must be last Route Created)
		server.get /.*/, restify.serveStatic config.api.static_file_server
		# Listen
		defer= Q.defer()
		try
			server.listen config.api.port, ()->
				log.info 'Server listening at', server.url
				defer.resolve null
		catch err
			defer.reject err
		return defer.promise

	.fail (err)->
		log.error err
		log.error 'SERVER FAILED TO INITIALIZE. EXITING NOW!'
		process.exit(1)

	return q_result
