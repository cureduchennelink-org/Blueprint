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
//	Server Initialization
//
// Config setings (createServer; resify: handlers,allow_headers; api: static_file_server,port;)
//  restify.createServer @config.createServer
//  for handler in @config.restify.handlers
//  res.setHeader 'access-control-allow-headers', @config.restify.allow_headers
//  server.get /.*/, restify.serveStatic @config.api.static_file_server
//  server.listen @config.api.port, cb

const restify= 	require('restify');
const E= 	require('restify-errors');
const _= 			require('lodash');

class Server {
	constructor(kit){
		this.config= kit.services.config;
		this.log= 	kit.services.logger.log;
		this.restify_logger= 	kit.services.restify_logger;
		this.server= false;
		this.log.info('Server Initialized...');
	}

	create() {
		return this.server= restify.createServer(_.merge({}, {log: (this.restify_logger != null ? this.restify_logger.log : undefined) != null ? (this.restify_logger != null ? this.restify_logger.log : undefined) : this.log}, this.config.createServer)); 	// Create Server
	}

	add_restify_handlers() {
		return (() => {
			const result = [];
			for (let handler of Array.from(this.config.restify.handlers)) {
				this.log.info(`(restify handler) Server.use ${handler}`, this.config.restify[ handler]);
				result.push(this.server.use(restify.plugins[handler](this.config.restify[ handler])));
			}
			return result;
		})();
	}

	handle_options() {
		// Handle all OPTIONS requests to a deadend (Allows CORS to work them out)
		this.log.info("(restify) Server.opts", this.config.restify.allow_headers);
		return this.server.opts('/*', ( req, res ) => {
			res.setHeader('access-control-allow-headers', (this.config.restify.allow_headers != null ? this.config.restify.allow_headers : []).join(', '));
			return res.send(204);
		});
	}

	parse_json() {
		// Parse JSON param
		return this.server.use(function(req, res, next){
			if ("JSON" in req.params) {
				_.merge(req.params, JSON.parse(req.params.JSON));
			}
			return next();
		});
	}

	strip_html() {
		// Strip all <> from params
		return this.server.use(function(req, res, next){
			for (let param in req.params) {
				if ((req.params[param] !== null) && _.isString(req.params[param])) {
					req.params[param]= req.params[param].replace(/[<>]/g, "");
				}
			}
			return next();
		});
	}

	add_static_server() {
		// Static File Server (Must be last Route Created)
		const api_path= '/api/*';
		const m= 'Api request did not match your route + method (extra slash?)';
		this.server.get(api_path, (q, r, n) => r.send(new E.BadRequestError(m))); // Don't let static-server match api calls
		const path= '/*';
		this.log.debug("(restify) serveStatic", {path,"@config.api.static_file_server":this.config.api.static_file_server});
		return this.server.get(path, restify.plugins.serveStatic(this.config.api.static_file_server));
	}
		// serveStatic = require 'serve-static-restify'

	start(cb){
		// Start the Server
		// Listen
		return this.server.listen(this.config.api.port, cb);
	}

	get() { return this.server; }
}

exports.Server= Server;
