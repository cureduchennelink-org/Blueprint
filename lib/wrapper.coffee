#
#	Route Wrapper Module
#
Promise= require 'bluebird'

request_count = 0
request_count_high= 0

class Wrapper
	@deps=
		mysql: ['core'], mongo: ['pool'], services:[ 'router', 'lamd', 'error', 'auth', ] # auth for req.auth via server.use
		config: 'throttling.max_connections,db.mysql.enable,auth.bearer,perf?.test_user_override'
	constructor: (kit) ->
		@config=	kit.services.config
		@E=			kit.services.error
		@odb= 		kit.services.db.mongo
		@sdb= 		kit.services.db.mysql
		@router= 	kit.services.router
		@lamd= 	    kit.services.lamd
		@routes= 	kit.routes
		@wraps= {}

	start_connection_limit: ->
		if @config.throttling.max_connections and request_count > @config.throttling.max_connections
			throw new @E.TooManyConnectionsError("Max:" + @config.throttling.max_connections + ", Count:" + request_count)
		request_count++
		request_count_high= request_count if request_count_high< request_count

	end_connection_limit: ->
		request_count-- if request_count

	add_wrap: (mod, wrap)=> # TODO: See where this is used
		@wraps[mod]= wrap

	add: (mod)=>
		f= 'Wrapper:add:'
		return @wraps[mod] mod if mod of @wraps
		for func, endpoint of @routes[mod].endpoints
			endpoint.name= mod+':'+func
			wrap= @[endpoint.wrap] endpoint
			@router.AddRoute mod, func, endpoint.verb, endpoint.route, wrap

	auth_wrap: (caller)->
		auth_func= @auth
		return (q,s,n)-> auth_func q, s, n, caller

	default_wrap: (caller)->
		func= @['default']
		return (q,s,n)-> func q, s, n, caller

	simple_wrap: (caller)->
		func= @simple
		return (q,s,n)-> func q, s, n, caller

	simple: (req, res, next, caller) ->
		f= "Wrapper:simple:#{caller.name}"
		route_logic= caller.version[req.params?.Version] ? caller.version.any
		return route_logic req if req is 'use'

		if caller.auth_required
			return next() if not req.auth.authorize()

		# Call the Route Logic.
		route_logic req, res, next

	auth: (req, res, next, caller)=>
		f= "Wrapper:auth"
		throw new @E.ServerError 'WRAPPER:AUTH:MYSQL_NOT_ENABLED' unless @config.db.mysql.enable
		route_logic= caller.version[req.params?.Version] ? caller.version.any
		return (if caller.use isnt true then caller.use else route_logic req) if req is 'use'
		ctx= conn: null, p: req.params, log: req.log
		p= ctx.p
		pre_loaded= {}
		send_result= false
		supported_grant_type= if p.grant_type in ['password','refresh_token','client_credentials'] then true else false
		@start_connection_limit()
		p.request_count= request_count
		p.request_count_high= request_count_high

		Promise.resolve().bind @
		.then ->

			# Validate client_id and grant_type
			throw new @E.MissingArg 'client_id' if not p.client_id
			throw new @E.OAuthError 400, 'unsupported_grant_type' if not supported_grant_type

			# Acquire DB Connection
			@sdb.core.Acquire()
		.then (c) ->
			ctx.conn= c if c isnt false

			# Start a Transaction
			@sdb.core.StartTransaction(ctx)
		.then () ->

			# Call the Auth Logic. Pass in pre_loaded variables
			route_logic ctx, pre_loaded
		.then (result_hash) ->
			send_result= result_hash.send

			# Commit the transaction
			@sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			@sdb.core.release ctx.conn if ctx.conn isnt null
			res.send send_result
			@end_connection_limit()
			next()

		.catch (err) ->
			if err.statusCode not in [ 400, 401, 403 ]
				req.log.error f, '.catch', err, err.stack
			else
				req.log.debug f, '.catch', err, err.stack
			if err.body and err.body.error is 'invalid_client'
				res.setHeader 'WWW-Authenticate', "Bearer realm=#{@config.auth.bearer}"
			if ctx.conn isnt null
				ctx.conn.query 'ROLLBACK', (err)=>
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						@sdb.core.destroy ctx.conn
						req.log.error f, '.catch', err.stack
					else
						req.log.debug f, 'release db conn (successful rollback)'
						@sdb.core.release ctx.conn
			res.send if err.body then err else new @E.ServerError err.name, err.message
			@end_connection_limit()
			next()

	default: (req, res, next, endpoint) =>
		f= "Wrapper:default:#{endpoint.name}"
		route_logic= endpoint.version[req.params?.Version] ? endpoint.version.any
		return (if endpoint.use isnt true then endpoint.use else route_logic req) if req is 'use'
		ctx=
			conn: null, p: req.params
			log: req.log, auth_id: req.auth?.authId
			files: req.files, req: req, res: res
			spec: endpoint
			lamd:
				start: (new Date().getTime()), route: endpoint.route, verb: endpoint.verb
				params: req.params, headers: req.headers, req_uuid: req._id, auth_id: 0
		p= ctx.p
		pre_loaded= {}
		result= false

		# 'Authorize' calls res.send so don't put this logic inside promise chain where we try to 'send' on error
		if endpoint.auth_required or endpoint.permit
			if @config.perf?.test_user_override is true and typeof p.mock_id is "string"
				pre_loaded.auth_id= Number p.mock_id
			else
				# Authorize calls res.send so don't put this logic inside promise change where we try to 'send' on error
				return next() if not req.auth.authorize()
				pre_loaded.auth_id= req.auth.authId
			ctx.lamd.auth_id= pre_loaded.auth_id

		Promise.resolve().bind @
		.then ->
			@start_connection_limit() # Keep this below any logic that might return before end_* is called
			p.request_count= ctx.lamd.request_count= request_count
			p.request_count_high= request_count_high

		.then ->

			# Acquire Mongo pool flavored Connection
			return false unless endpoint.mongo_pool
			throw new @E.ServerError 'WRAPPER:DEFAULT:UNKNOWN_MONGO_POOL:'+ endpoint.mongo_pool unless endpoint.mongo_pool of @odb.pool
			ctx.pool= @odb.pool[ endpoint.mongo_pool]
		.then ->

			# Acquire DB Connection
			return false unless endpoint.sql_conn
			throw new @E.ServerError 'WRAPPER:DEFAULT:MYSQL_NOT_ENABLED' unless @config.db.mysql.enable
			@sdb.core.Acquire()
		.then (c)->
			ctx.conn= c if c isnt false

			# Start a Transaction
			return false unless endpoint.sql_tx
			throw new @E.ServerError 'WRAPPER:DEFAULT:MYSQL_NOT_ENABLED' unless @config.db.mysql.enable
			@sdb.core.StartTransaction(ctx)
		.then ->

			# Loop through the endpoint's pre_load functions
			q_result = Promise.resolve().bind @
			for nm,func of endpoint.pre_load
				do (nm,func) =>
					q_result= q_result.then ->
						func ctx, pre_loaded
					.then (pre_load_result)->
						ctx.log.debug f+ ':pre-load', "got #{nm}:", pre_load_result
						pre_loaded[nm]= pre_load_result
			q_result
		.then ->

			# Call the Route Logic. Pass in pre_loaded variables
			route_logic ctx, pre_loaded
		.then (result_hash)->
			result= result_hash

			# Commit the transaction
			return false unless endpoint.sql_conn
			@sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result)->

			# Release database conn; Respond to Client
			delete ctx.pool
			@sdb.core.release ctx.conn if ctx.conn isnt null
			res.send result.send unless endpoint.is_websock
			ctx.lamd.statusCode= res.statusCode
			end = (new Date().getTime())
			ctx.lamd.duration = end - ctx.lamd.start
			@lamd.write ctx.lamd unless endpoint.lamd is false
			@end_connection_limit()
			next()

		.catch (err)->
			delete ctx.pool
			if err.statusCode not in [ 400, 403 ]
				req.log.error f, '.catch', err, err.stack
			else
				req.log.debug f, '.catch', err
			if ctx.conn isnt null
				ctx.conn.query 'ROLLBACK', (err)=>
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						@sdb.core.destroy ctx.conn
						req.log.error f, '.catch', err.stack
					else
						req.log.debug f, 'release db conn (successful rollback)'
						@sdb.core.release ctx.conn
			res.send if err.body then err else new @E.ServerError err.name, err.message
			ctx.lamd.statusCode= res.statusCode
			end = (new Date().getTime())
			ctx.lamd.duration = end - ctx.lamd.start
			ctx.lamd.err= @_exposeErrorProperties err
			@lamd.write ctx.lamd
			@end_connection_limit()
			next()

	# https://www.bennadel.com/blog/3278-using-json-stringify-replacer-function-to-recursively-serialize-and-sanitize-log-data.htm
	_exposeErrorProperties: (error)->
		copy= Object.assign {}, error
		# In the native Error class (and any class that extends Error), the
		# following properties are not "enumerable". As such, they won't be copied by
		# the Object.assign() call above. In order to make sure that they are included
		# in the serialization process, we have to copy them manually.
		copy.name= error.name if error.name
		copy.message= error.message if error.message
		#copy.stack= error.stack if error.stack
		copy

exports.Wrapper= Wrapper
