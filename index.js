/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Server Initialization
//

exports.start= function(){
	// Require Node Modules
	let mod, nm, service;
	const M= 			require('moment');
	const Q= 			require('q');
	const restify= 	require('restify');
	const _= 			require('lodash');
	const path= 		require('path');

	// Set default format for moment
	M.defaultFormat= 'YYYY-MM-DD HH:mm:ss';

	// Library Modules and Services
	const {Kit}=		require('./lib/kit');
	const config= 	(require('./config'))();
	const {Logger}=	require('./lib/logger');
	const Error= 		require('./lib/error');

	// Initialize kit and set up with core services (config, logger, error)
	const kit= new Kit;
	kit.add_service('config', 		config);					// Config Object
	kit.new_service('logger', 		Logger);					// Bunyan Logger
	kit.add_service('error', 		Error);					// Error Objects

	const { log }= 	kit.services.logger;
	const server= restify.createServer({log}); 	// Create Server
	kit.add_service('server', server); 		// Add server to kit

	// Services
	for (nm in kit.services.config.service_modules) {
		mod = kit.services.config.service_modules[nm];
		if (mod.enable === true) {
			log.info(`Initializing ${mod.class} Service...`);
			const opts= mod.instConfig ? [mod.instConfig] : null;
			const servicePath= path.join(config.processDir, mod.file);
			kit.new_service(mod.name, (require(servicePath))[mod.class], opts);
		}
	}

	// Restify Hanlders
	for (let handler of Array.from(config.restify.handlers)) {
		server.use(restify[handler]());
	}

	// Service Handlers
	for (nm in kit.services) {
		service = kit.services[nm];
		if (typeof service.server_use === 'function') {
			server.use(service.server_use);
		}
	}

	// Parse JSON param
	server.use(function(req, res, next){
		if ("JSON" in req.params) {
			_.merge(req.params, JSON.parse(req.params.JSON));
		}
		return next();
	});

	// Strip all <> from params
	server.use(function(req, res, next){
		for (let param in req.params) {
			if ((req.params[param] !== null) && _.isString(req.params[param])) {
				req.params[param]= req.params[param].replace(/[<>]/g, "");
			}
		}
		return next();
	});

	// Routes
	for (nm in kit.services.config.route_modules) {
		mod = kit.services.config.route_modules[nm];
		if (mod.enable === true) {
			log.info(`Initializing ${mod.class} Routes...`);
			const routePath= path.join(config.processDir, mod.file);
			kit.new_route_service(mod.name, (require(routePath))[mod.class]);
			kit.services.wrapper.add(mod.name);
		}
	}

	// Run Server Init Functions from Kit Service Modules
	let q_result= Q.resolve();
	for (nm in kit.services) {
		service = kit.services[nm];
		if (typeof service.server_init === 'function') {
			(service=> q_result= q_result.then(() => service.server_init(kit)))(service);
		}
	}

	// Run Server Init Functions from Kit Route Modules
	for (nm in kit.routes) {
		const route = kit.routes[nm];
		if (typeof route.server_init === 'function') {
			(route=> q_result= q_result.then(() => route.server_init(kit)))(route);
		}
	}

	// Run Server Start Functions from Kit Service Modules
	for (nm in kit.services) {
		service = kit.services[nm];
		if (typeof service.server_start === 'function') {
			(service=> q_result= q_result.then(() => service.server_start(kit)))(service);
		}
	}

	// Start the Server
	return q_result.then(function() {
		// Static File Server (Must be last Route Created)
		server.get(/.*/, restify.serveStatic(config.api.static_file_server));
		// Listen
		return server.listen(config.api.port, ()=> log.info('Server listening at', server.url));}).fail(function(err){
		log.error(err);
		log.error('SERVER FAILED TO INITIALIZE. EXITING NOW!');
		return process.exit(1);
	});
};
