#
#	Server Initialization
#
# Config setings (createServer; resify: handlers,allow_headers; api: static_file_server,port;)
#  restify.createServer @config.createServer
#  for handler in @config.restify.handlers
#  res.setHeader 'access-control-allow-headers', @config.restify.allow_headers
#  server.get /.*/, restify.serveStatic @config.api.static_file_server
#  server.listen @config.api.port, cb

restify= 	require 'restify'
_= 			require 'lodash'

class Server
	constructor: (kit)->
		@config= kit.services.config
		@log= 	kit.services.logger.log
		@server= false
		@log.info 'Server Initialized...'

	create: ->
		@server= restify.createServer _.merge {}, {@log}, @config.createServer 	# Create Server

	add_restify_handlers: ->
		for handler in @config.restify.handlers
			log.info "(restify handler) Server.use #{handler}", @config.restify[ handler]
			server.use restify[handler] @config.restify[ handler]

	handle_options: ->
		# Handle all OPTIONS requests to a deadend (Allows CORS to work them out)
		log.info "(restify) Server.opts", @config.restify.allow_headers
		server.opts /.*/, ( req, res ) =>
			res.setHeader 'access-control-allow-headers', (@config.restify.allow_headers ? []).join ', '
			res.send 204

	parse_json: ->
		# Parse JSON param
		server.use (req, res, next)->
			if "JSON" of req.params
				_.merge req.params, JSON.parse req.params.JSON
			next()

	strip_html: ->
		# Strip all <> from params
		server.use (req, res, next)->
			for param of req.params
				if req.params[param] isnt null and _.isString(req.params[param])
					req.params[param]= req.params[param].replace /[<>]/g, ""
			next()

	add_static_server: ->
		# Static File Server (Must be last Route Created)
		server.get /.*/, restify.serveStatic @config.api.static_file_server

	start: (cb)->
		# Start the Server
		# Listen
		server.listen @config.api.port, cb

	get: -> @server

exports.Server= Server
