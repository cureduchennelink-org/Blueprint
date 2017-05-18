#
#	DVblueprint Initialization
#

exports.start= (include_server, services_enabled, routes_enabled, mysql_enabled, mysql_mods_enabled, mongo_enabled, more_config= {})->
	server= false # For unit tests, may not include the restify server logic
	# Require Node Modules
	M= 			require 'moment'
	Q= 			require 'q'
	path= 		require 'path'
	_= 			require 'lodash'

	# Set default format for moment
	M.defaultFormat= 'YYYY-MM-DD HH:mm:ss'

	# Library Modules and Services
	{Kit}=		require  './lib/kit'
	config= 	(require './config')()
	config= _.merge config, more_config # To allow e.g. test harness to inject a few config settings
	{Logger}=	require  './lib/logger'
	ErrorMore= 	require  './lib/error'

	# Initialize kit and set up with core services (config, logger, error)
	kit= new Kit
	kit.add_service 'config', 		config					# Config Object
	kit.new_service 'logger', 		Logger					# Bunyan Logger
	kit.add_service 'error', 		ErrorMore				# Error Objects
	log= 	kit.services.logger.log

	# Pass inbound module enabled preferences through, for db layer's use
	config.db.mysql.enable= mysql_enabled if mysql_enabled
	config.db.mysql.mods_enabled= mysql_mods_enabled
	config.db.mongo.enable= mongo_enabled if mongo_enabled

	if include_server
		{Server}= require './lib/server'
		server= new Server kit
		server.create()
		kit.add_service 'server', server					# Add server-service to kit

	# Services
	for nm in services_enabled
		mod= kit.services.config.service_modules[ nm]
		throw new Error "No such service-module: #{nm}" unless mod
		mod.name= nm
		log.info "Initializing #{mod.class} Service..."
		opts= if mod.instConfig then [mod.instConfig] else null
		servicePath= path.join config.processDir, mod.file
		kit.new_service mod.name, (require servicePath)[mod.class], opts

	server.add_restify_handlers() if server
	# Handle all OPTIONS requests to a deadend (Allows CORS to work them out)
	server.handle_options() if server

	# Service Handlers
	if server
		for nm, service of kit.services when typeof service.server_use is 'function'
			log.info "Calling server.use for service: "+ nm
			server.server.use service.server_use

	server.parse_json() if server
	server.strip_html() if server

	# Routes
	for nm in routes_enabled
		mod= kit.services.config.route_modules[ nm]
		throw new Error "No such route-module: #{nm}" unless mod
		mod.name= nm
		log.info "Initializing #{mod.class} Routes..."
		routePath= path.join config.processDir, mod.file
		kit.new_route_service mod.name, (require routePath)[mod.class]
		kit.services.wrapper.add mod.name

	# Run Server Init Functions from Kit Service Modules
	q_result= Q.resolve()
	for nm, service of kit.services
		do(service)->
			if typeof service.server_init is 'function'
				q_result= q_result.then -> service.server_init kit # Single return promise w/o embedded .then
			if typeof service.server_init_promise is 'function'
				do(service)-> q_result= service.server_init_promise kit, q_result # will chain it's .then's

	# Run Server Init Functions from Kit Route Modules
	for nm, route of kit.routes when typeof route.server_init is 'function'
		do(route)-> q_result= q_result.then -> route.server_init(kit)

	# Run Server Start Functions from Kit Service Modules
	for nm, service of kit.services when typeof service.server_start is 'function'
		do(service)-> q_result= q_result.then -> service.server_start(kit)

	# Start the Server
	if server
		q_result= q_result.then ->
			# Static File Server (Must be last Route Created)
			server.add_static_server()
			defer= Q.defer()
			try
				server.start ->
					log.info 'Server listening at', server.url
					defer.resolve null
			catch err
				defer.reject err
			return defer.promise

	q_result= q_result.then ->
		log.debug 'SERVER NORMAL START'
		kit # JCS: Return the kit so caller can get to servies (e.g. kit.services.server.server)

	q_result= q_result.fail (err)->
		log.error err
		log.error 'SERVER FAILED TO INITIALIZE. EXITING NOW!'
		process.exit(1)

	q_result
