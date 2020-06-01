corsMiddleware= require 'restify-cors-middleware'

class CORS
	@deps: services: ['config', 'server']
	constructor: (kit)->
		@cors= corsMiddleware kit.services.config.restify.CORS

	server_init: (kit)->
		server= kit.services.server.server
		server.pre @cors.preflight
		server.use @cors.actual

exports.CORS= CORS

