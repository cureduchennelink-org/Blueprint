// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	DVblueprint Initialization
//
let _= require('lodash');
const path= require('path');

// TODO HAVE A 'init' METHOD TO LOAD FIRST kit, config, logger AND MAYBE error WHICH TAKES PARAMS SO YOU CAN CIRCUMVENT ENV FOR E.G. TEST HARNESS DOING ONE MODULE UNIT TEST
exports.start= function(include_server, services_enabled, routes_enabled, mysql_enabled, mysql_mods_enabled,psql_enabled, psql_mods_enabled, mongo_enabled, more_config, more_kit){
	let mod, nm, service;
	if (mysql_enabled == null) { mysql_enabled = false; }
	if (mysql_mods_enabled == null) { mysql_mods_enabled = []; }
	if (psql_enabled == null) { psql_enabled = false; }
	if (psql_mods_enabled == null) { psql_mods_enabled = []; }
	if (mongo_enabled == null) { mongo_enabled = false; }
	if (more_config == null) { more_config = {}; }
	if (more_kit == null) { more_kit = {}; }
	let server= false; // For unit tests, may not include the restify server logic
	// Require Node Modules
	const M= 			require('moment');
	const Promise=	require('bluebird');
	_= 			require('lodash');

	// Set default format for moment
	M.defaultFormat= 'YYYY-MM-DD HH:mm:ss';

	// Library Modules and Services
	const {Kit}=		require('./lib/kit');
	let config= 	(require('./config'))();
	config= _.merge(config, more_config); // To allow e.g. test harness to inject a few config settings
	const {Logger}=	require('./lib/logger');
	const ErrorMore= 	require('./lib/error');

	// Initialize kit and set up with core services (config, logger, error)
	let kit= new Kit;
	kit.add_service('config', 		config);					// Config Object
	kit.new_service('logger', 		Logger);					// Bunyan Logger
	kit.add_service('error', 		ErrorMore);				// Error Objects
	kit.services.restify_logger= kit.services.logger; // So logging can be overriden for all except restify
	kit= _.merge(kit, more_kit); // To allow e.g. test harness to inject a few config settings
	const {
        log
    } = kit.services.logger;

	// Pass inbound module enabled preferences through, for db layer's use
	if (mysql_enabled) { config.db.mysql.enable= mysql_enabled; }
	config.db.mysql.mods_enabled= mysql_mods_enabled;
	if (psql_enabled) { config.db.psql.enable= psql_enabled; }
	config.db.psql.mods_enabled= psql_mods_enabled;
	if (mongo_enabled) { config.db.mongo.enable= mongo_enabled; }

	if (include_server) {
		const {Server}= require('./lib/server');
		server= new Server(kit);
		server.create();
		kit.add_service('server', server);					// Add server-service to kit
	}

	[services_enabled, mysql_mods_enabled, psql_mods_enabled]= Array.from(update_deps(kit, services_enabled, routes_enabled, mysql_mods_enabled, psql_mods_enabled));
	// TODO When 'db' is added, caller will have to enable that?

	// Services
	for (nm of Array.from(services_enabled)) {
		mod= kit.services.config.service_modules[ nm];
		if (!mod) { throw new Error(`No such service-module: ${nm}`); }
		mod.name= nm;
		log.info(`Initializing ${mod.class} Service...`);
		const opts= mod.instConfig ? [mod.instConfig] : null;
		const servicePath= path.join(config.processDir, mod.file);
		kit.new_service(mod.name, (require(servicePath))[mod.class], opts);
	}

	if (server) { server.add_restify_handlers(); }
	// Handle all OPTIONS requests to a deadend (Allows CORS to work them out)
	// Use CORS service (In pangea-api-server for now) in place of this: server.handle_options() if server

	// Service Handlers
	if (server) {
		for (nm in kit.services) {
			service = kit.services[nm];
			if (typeof service.server_use === 'function') {
				log.info("Calling server.use for service: "+ nm);
				server.server.use(service.server_use);
			}
		}
	}

	if (server) { server.parse_json(); }
	if (server) { server.strip_html(); }

	// Run Server Init Functions from Kit Service Modules
	let q_result= Promise.resolve().bind(this);
	for (nm in kit.services) {
		service = kit.services[nm];
		(function(service){
			if (typeof service.server_init === 'function') {
				q_result= q_result.then(() => service.server_init(kit)); // Single return promise w/o embedded .then
			}
			if (typeof service.server_init_promise === 'function') {
				return ((service => q_result= service.server_init_promise(kit, q_result)))(service); // will chain it's .then's
			}
		})(service);
	}

	// Routes
	for (nm of Array.from(routes_enabled)) {
		mod= kit.services.config.route_modules[ nm];
		if (!mod) { throw new Error(`No such route-module: ${nm}`); }
		mod.name= nm;
		log.info(`Initializing ${mod.class} Routes...`);
		const routePath= path.join(config.processDir, mod.file);
		kit.new_route_service(mod.name, (require(routePath))[mod.class]);
		kit.services.wrapper.add(mod.name);
	}

	// Run Server Init Functions from Kit Route Modules
	for (nm in kit.routes) {
		const route = kit.routes[nm];
		if (typeof route.server_init === 'function') {
			((route => q_result= q_result.then(() => route.server_init(kit))))(route);
		}
	}

	// Run Server Start Functions from Kit Service Modules
	for (nm in kit.services) {
		service = kit.services[nm];
		if (typeof service.server_start === 'function') {
			((service => q_result= q_result.then(() => service.server_start(kit))))(service);
		}
	}

	// Start the Server
	if (server) {
		q_result= q_result.then(function() {
			// Static File Server (Must be last Route Created)
			if (config.api != null ? config.api.static_file_server : undefined) { server.add_static_server(); }
			return new Promise(function(resolve, reject){
				try {
					return server.start(function() {
						log.info('Server listening at', server.server.url);
						return resolve(null);
					});
				} catch (err) {
					return reject(err);
				}
			});
		});
	}

	q_result= q_result.then(function() {
		log.debug('SERVER NORMAL START');
		return kit;
	}); // JCS: Return the kit so caller can get to servies (e.g. kit.services.server.server)

	q_result= q_result.catch(function(err){
		log.error(err);
		log.error('SERVER FAILED TO INITIALIZE. EXITING NOW!');
		return process.exit(1);
	});

	return q_result;
};

var update_deps= function(kit, services_enabled, routes_enabled, mysql_mods_enabled, psql_mods_enabled){
	let dep, deps, mod, module, servicePath;
	let start_length;
	let nm, service, child;
	const f= '(Start)Index::update_deps:';
	const {
        config
    } = kit.services;
	const _log= kit.services.logger.log;
	//_log.debug f+"USER_REQUESTED", {services_enabled,routes_enabled,mysql_mods_enabled}
	const all_mods= mysql_mods_enabled.concat(psql_mods_enabled); // TODO NEED TO LOAD THESE DEPS ALSO
	const special= []; // TODO MAYBE KIT FILTERED WHAT WAS ALREADY LOADED ['config','logger','error']
	const service_to_deps= {}; // False if needing to get deps, else [] of deps
	for (nm of Array.from(services_enabled)) { service_to_deps[ nm]= false; }
	if (routes_enabled.length) {
		for (nm of ['wrapper','router']) { service_to_deps[ nm]= false; }
	}

	// Routes depend on services and mysql-mods; add their needs first
	for (nm of Array.from(routes_enabled)) {
		mod= config.route_modules[ nm];
		if (!mod) { throw new Error(f+ `No such route-module: ${nm}`); }
		servicePath= path.join(config.processDir, mod.file);
		//_log.debug f+ 'INSPECTING ROUTE MODULE', {servicePath,mod}
		module= (require(servicePath));
		if (!(mod.class in module)) { throw new Error(f+ `Class (${mod.class}) not found in file (${servicePath})`); }
		deps= kit.get_service_deps_needed(nm, module[mod.class]);
		//_log.debug f+ ':route', {nm,deps}
		for (let snm of Array.from(deps)) { service_to_deps[ snm]= false; }
	} // Add all services that any route depends on

	for (nm of Array.from(special)) { service_to_deps[ nm]= []; } // These are base services with no deps that are always 'provided'
	let services_to_check= ((() => {
		const result = [];
		for (nm in service_to_deps) {
			if (service_to_deps[ nm] === false) {
				result.push(nm);
			}
		}
		return result;
	})());
	while (services_to_check.length) {
		const new_services= []; // Added to if not already in the list
		for (nm of Array.from(services_to_check)) {
			mod= config.service_modules[ nm];
			if (!mod) { throw new Error(f+ `No such service-module: ${nm}`); }
			servicePath= path.join(config.processDir, mod.file);
			//_log.debug f+ 'INSPECTING SERVICE MODULE', {servicePath,mod}
			module= (require(servicePath));
			if (!(mod.class in module)) { throw new Error(f+ `Class (${mod.class}) not found in file (${servicePath})`); }
			deps= kit.get_service_deps_needed(nm, module[mod.class]);
			service_to_deps[ nm]= deps;
			for (dep of Array.from(deps)) { if (!(dep in service_to_deps)) { service_to_deps[ dep]= false; } }
		}
		services_to_check= ((() => {
			const result1 = [];
			for (nm in service_to_deps) {
				if (service_to_deps[ nm] === false) {
					result1.push(nm);
				}
			}
			return result1;
		})());
	}
		//_log.debug f+ ':more_services', {services_to_check}
	//_log.debug f+ ':services', {service_to_deps}

	const s2child= {};
	const all_services= [];
	const present= {};
	for (nm in service_to_deps) {
		deps = service_to_deps[nm];
		present[ nm]= false;
		if (s2child[ nm] == null) {s2child[nm] = []; } // Make sure I exist here, even if no deps
		for (dep of Array.from(deps)) { // Consider nm as a 'child' of each dependancy
			if (s2child[ dep] == null) {s2child[dep] = []; }
			s2child[ dep].push(nm);
			present[ dep]= false;
		}
	}

	/*
	* Assume end-user got his services listed in the right order, for now # TODO
	for service in services_enabled when not present[ service]
		all_services.push service # Can go anytime, but might need to be before someone else, so put first in list
		present[ service]= true
	*/
		
	// Add each service as late as possible (just before any known child(who depends on it))
	let try_list= ((() => {
		const result2 = [];
		for (service in s2child) {
			if (!present[ service]) {
				result2.push(service);
			}
		}
		return result2;
	})());
	//_log.debug f+ ':TRY_LIST_TOP', {s2child,all_services,present,try_list}
	while ((start_length= try_list.length)) {
		// Place this service in front of all children if all are present
		for (service in s2child) {
			//_log.debug f+"TOP_OF_SERVICE_LOOP", {service,children,present,all_services}
			var children = s2child[service];
			if (present[ service]) { continue; }
			let all_present= true; // Assumption
			for (child of Array.from(children)) {
				//_log.debug f+"CHILD_LOOP", {child,p:present[ child]}
				if (present[ child] === false) {
					all_present= false;
					break;
				}
			}
			//_log.debug f+'ALL_PRESENT?', {service,all_present,children}
			if (!all_present) { continue; } // Try again later
			// Find nearest neighbor
			if (children.length === 0) {
				all_services.push(service); // Can go on the end, eh?
			} else { // Before child closest to the front
				//_log.debug f+"MIN_LIST", {service,index:(all_services.indexOf child for child in children)}
				const min= _.min(((() => {
					const result3 = [];
					for (child of Array.from(children)) { 						result3.push(all_services.indexOf(child));
					}
					return result3;
				})()));
				if (min < 0) { throw new Error(f+`BROKEN LOGIC child=${child}`); }
				//_log.debug f+"SPLICE_BEFORE", {service,min,all_services}
				all_services.splice(min, 0, service);
			}
				//_log.debug f+"SPLICE_AFTER", {service,all_services}
			present[ service]= true;
		}
		try_list= ((() => {
			const result4 = [];
			for (service in s2child) {
				if (!present[ service]) {
					result4.push(service);
				}
			}
			return result4;
		})());
		//_log.debug f+"dep-loop-bottom", {start_length,try_list,all_services,present,s2child}
		if (try_list.length === start_length) { throw new Error(f+"Some wierdness in dependancies"); }
	}

		
	// TODO all_mods (based on both routes and services [and other mods?]
	_log.debug(f+'FINAL', {all_services,s2child});
	return [all_services, all_mods];
};
