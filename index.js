#
#	DVblueprint Initialization
#
_= require 'lodash'
path= require 'path'

# TODO HAVE A 'init' METHOD TO LOAD FIRST kit, config, logger AND MAYBE error WHICH TAKES PARAMS SO YOU CAN CIRCUMVENT ENV FOR E.G. TEST HARNESS DOING ONE MODULE UNIT TEST
exports.start= (include_server, services_enabled, routes_enabled, mysql_enabled= false, mysql_mods_enabled= [],psql_enabled= false, psql_mods_enabled= [], mongo_enabled= false, more_config= {}, more_kit= {})->
	server= false # For unit tests, may not include the restify server logic
	# Require Node Modules
	M= 			require 'moment'
	Promise=	require 'bluebird'
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
	kit.services.restify_logger= kit.services.logger # So logging can be overriden for all except restify
	kit= _.merge kit, more_kit # To allow e.g. test harness to inject a few config settings
	log= 	kit.services.logger.log

	# Pass inbound module enabled preferences through, for db layer's use
	config.db.mysql.enable= mysql_enabled if mysql_enabled
	config.db.mysql.mods_enabled= mysql_mods_enabled
	config.db.psql.enable= psql_enabled if psql_enabled
	config.db.psql.mods_enabled= psql_mods_enabled
	config.db.mongo.enable= mongo_enabled if mongo_enabled

	if include_server
		{Server}= require './lib/server'
		server= new Server kit
		server.create()
		kit.add_service 'server', server					# Add server-service to kit

	[services_enabled, mysql_mods_enabled, psql_mods_enabled]= update_deps kit, services_enabled, routes_enabled, mysql_mods_enabled, psql_mods_enabled
	# TODO When 'db' is added, caller will have to enable that?

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
	# Use CORS service (In pangea-api-server for now) in place of this: server.handle_options() if server

	# Service Handlers
	if server
		for nm, service of kit.services when typeof service.server_use is 'function'
			log.info "Calling server.use for service: "+ nm
			server.server.use service.server_use

	server.parse_json() if server
	server.strip_html() if server

	# Run Server Init Functions from Kit Service Modules
	q_result= Promise.resolve().bind @
	for nm, service of kit.services
		do(service)->
			if typeof service.server_init is 'function'
				q_result= q_result.then -> service.server_init kit # Single return promise w/o embedded .then
			if typeof service.server_init_promise is 'function'
				do(service)-> q_result= service.server_init_promise kit, q_result # will chain it's .then's

	# Routes
	for nm in routes_enabled
		mod= kit.services.config.route_modules[ nm]
		throw new Error "No such route-module: #{nm}" unless mod
		mod.name= nm
		log.info "Initializing #{mod.class} Routes..."
		routePath= path.join config.processDir, mod.file
		kit.new_route_service mod.name, (require routePath)[mod.class]
		kit.services.wrapper.add mod.name

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
			server.add_static_server() if config.api?.static_file_server
			new Promise (resolve, reject)->
				try
					server.start ->
						log.info 'Server listening at', server.server.url
						resolve null
				catch err
					reject err

	q_result= q_result.then ->
		log.debug 'SERVER NORMAL START'
		kit # JCS: Return the kit so caller can get to servies (e.g. kit.services.server.server)

	q_result= q_result.catch (err)->
		log.error err
		log.error 'SERVER FAILED TO INITIALIZE. EXITING NOW!'
		process.exit(1)

	q_result

update_deps= (kit, services_enabled, routes_enabled, mysql_mods_enabled, psql_mods_enabled)->
	f= '(Start)Index::update_deps:'
	config= kit.services.config
	_log= kit.services.logger.log
	#_log.debug f+"USER_REQUESTED", {services_enabled,routes_enabled,mysql_mods_enabled}
	all_mods= mysql_mods_enabled.concat psql_mods_enabled # TODO NEED TO LOAD THESE DEPS ALSO
	special= [] # TODO MAYBE KIT FILTERED WHAT WAS ALREADY LOADED ['config','logger','error']
	service_to_deps= {} # False if needing to get deps, else [] of deps
	service_to_deps[ nm]= false for nm in services_enabled
	if routes_enabled.length
		service_to_deps[ nm]= false for nm in ['wrapper','router']

	# Routes depend on services and mysql-mods; add their needs first
	for nm in routes_enabled
		mod= config.route_modules[ nm]
		throw new Error f+ "No such route-module: #{nm}" unless mod
		servicePath= path.join config.processDir, mod.file
		#_log.debug f+ 'INSPECTING ROUTE MODULE', {servicePath,mod}
		module= (require servicePath)
		throw new Error f+ "Class (#{mod.class}) not found in file (#{servicePath})" unless mod.class of module
		deps= kit.get_service_deps_needed nm, module[mod.class]
		#_log.debug f+ ':route', {nm,deps}
		service_to_deps[ snm]= false for snm in deps # Add all services that any route depends on

	service_to_deps[ nm]= [] for nm in special # These are base services with no deps that are always 'provided'
	services_to_check= (nm for nm of service_to_deps when service_to_deps[ nm] is false)
	while services_to_check.length
		new_services= [] # Added to if not already in the list
		for nm in services_to_check
			mod= config.service_modules[ nm]
			throw new Error f+ "No such service-module: #{nm}" unless mod
			servicePath= path.join config.processDir, mod.file
			#_log.debug f+ 'INSPECTING SERVICE MODULE', {servicePath,mod}
			module= (require servicePath)
			throw new Error f+ "Class (#{mod.class}) not found in file (#{servicePath})" unless mod.class of module
			deps= kit.get_service_deps_needed nm, module[mod.class]
			service_to_deps[ nm]= deps
			service_to_deps[ dep]= false for dep in deps when dep not of service_to_deps
		services_to_check= (nm for nm of service_to_deps when service_to_deps[ nm] is false)
		#_log.debug f+ ':more_services', {services_to_check}
	#_log.debug f+ ':services', {service_to_deps}

	s2child= {}
	all_services= []
	present= {}
	for nm,deps of service_to_deps
		present[ nm]= false
		s2child[ nm]?= [] # Make sure I exist here, even if no deps
		for dep in deps # Consider nm as a 'child' of each dependancy
			s2child[ dep]?= []
			s2child[ dep].push nm
			present[ dep]= false

	###
	# Assume end-user got his services listed in the right order, for now # TODO
	for service in services_enabled when not present[ service]
		all_services.push service # Can go anytime, but might need to be before someone else, so put first in list
		present[ service]= true
	###
		
	# Add each service as late as possible (just before any known child(who depends on it))
	try_list= (service for service of s2child when not present[ service])
	#_log.debug f+ ':TRY_LIST_TOP', {s2child,all_services,present,try_list}
	while start_length= try_list.length
		# Place this service in front of all children if all are present
		for service,children of s2child
			#_log.debug f+"TOP_OF_SERVICE_LOOP", {service,children,present,all_services}
			continue if present[ service]
			all_present= true # Assumption
			for child in children
				#_log.debug f+"CHILD_LOOP", {child,p:present[ child]}
				if present[ child] is false
					all_present= false
					break
			#_log.debug f+'ALL_PRESENT?', {service,all_present,children}
			continue unless all_present # Try again later
			# Find nearest neighbor
			if children.length is 0
				all_services.push service # Can go on the end, eh?
			else # Before child closest to the front
				#_log.debug f+"MIN_LIST", {service,index:(all_services.indexOf child for child in children)}
				min= _.min (all_services.indexOf child for child in children)
				throw new Error f+"BROKEN LOGIC child=#{child}" if min < 0
				#_log.debug f+"SPLICE_BEFORE", {service,min,all_services}
				all_services.splice min, 0, service
				#_log.debug f+"SPLICE_AFTER", {service,all_services}
			present[ service]= true
		try_list= (service for service of s2child when not present[ service])
		#_log.debug f+"dep-loop-bottom", {start_length,try_list,all_services,present,s2child}
		throw new Error f+"Some wierdness in dependancies" if try_list.length is start_length

		
	# TODO all_mods (based on both routes and services [and other mods?]
	_log.debug f+'FINAL', {all_services,s2child}
	[all_services, all_mods]
