#
#	Route Wrapper Module
#
# LAMD is not included in 'services' and must be manually added in your start-up. If it is not detected, standard bunyan is used
# TODO for LAMD:
#  - Sanitize function (I think SWMD has it)
#  - .start that is human readable
#
Promise= require 'bluebird'
_= require 'lodash'

request_count = 0
request_count_high= 0

class Wrapper
	@deps=
		mysql: ['core'], mongo: ['pool'], services:[ 'router', 'error', 'auth', ] # auth for req.auth via server.use
		config: 'throttling.max_connections,db.mysql.enable,auth.bearer,perf?.test_user_override'
	constructor: (kit) ->
		@config=	kit.services.config
		@E=			kit.services.error
		@odb= 		kit.services.db.mongo
		@sdb= 		kit.services.db.mysql
		@router= 	kit.services.router
		stubb_lamd=
			GetLog: (ctx)->ctx.log
			write: (lamd)-> console.log lamd
			write_deep: (ctx)-> console.log 'stubb_lamd::write_deep'
		@lamd= 	    kit.services.lamd ? stubb_lamd # You would need to add this service in your start-up script
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

	auth: (req, res, next, endpoint)=>
		f= "Wrapper:auth"
		throw new @E.ServerError 'WRAPPER:AUTH:MYSQL_NOT_ENABLED' unless @config.db.mysql.enable
		route_logic= endpoint.version[req.params?.Version] ? endpoint.version.any
		return (if endpoint.use isnt true then endpoint.use else route_logic req) if req is 'use'
		ctx=
			conn: null, p: req.params
			log: req.log, auth_id: req.auth?.authId
			files: req.files, req: req, res: res
			spec: endpoint
			lamd:
				start: (new Date().getTime()), route: endpoint.route, verb: endpoint.verb
				params: (_.cloneDeep req.params) , headers: req.headers, req_uuid: req._id, auth_id: 0
				conn_id: 0
		ctx.log= @lamd.GetLog ctx
		p= ctx.p
		pre_loaded= {}
		result= false
		supported_grant_type= if p.grant_type in ['password','refresh_token','client_credentials'] then true else false

		Promise.resolve().bind @
		.then ->

			# Validate client_id and grant_type
			throw new @E.MissingArg 'client_id' if not p.client_id
			throw new @E.OAuthError 400, 'unsupported_grant_type' if not supported_grant_type

			@start_connection_limit() # Keep this below any logic that might return before end_* is called
			ctx.lamd.request_count= request_count
			ctx.lamd.request_count_high= request_count_high

			# Acquire DB Connection
			@sdb.core.Acquire()
		.then (c) ->
			ctx.conn= c if c isnt false
			ctx.lamd.conn_id= c.__pool_id
			throw new @E.ServerError f + 'BadHandle:' + JSON.stringify @_exposeErrorProperties ctx.conn._protocol._fatalError if ctx.conn isnt null and ctx.conn._protocol._fatalError isnt null

			# Start a Transaction
			@sdb.core.StartTransaction(ctx)
		.then () ->

			# Call the Auth Logic. Pass in pre_loaded variables
			route_logic ctx, pre_loaded
		.then (result_hash) ->
			throw new @E.ServerError f + 'BadHandle:' + JSON.stringify @_exposeErrorProperties ctx.conn._protocol._fatalError if ctx.conn isnt null and ctx.conn._protocol._fatalError isnt null
			result= result_hash

			# Commit the transaction
			@sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			@sdb.core.release ctx.conn if ctx.conn isnt null
			result.send?.req_uuid= ctx.lamd.req_uuid # TODO ASSUMES RESULT.SEND IS AN OBJECT
			# Not for /Auth - res.send result.send unless endpoint.is_websock
			ctx.lamd.statusCode= res.statusCode
			end = (new Date().getTime())
			ctx.lamd.duration = end - ctx.lamd.start
			@lamd.write ctx.lamd unless endpoint.lamd is false
			@lamd.write_deep ctx unless endpoint.lamd is false # TODO CHECK CONFIG IF WE WANT 200'S TO ALSO LOG THIS
			@end_connection_limit()
			next() # Note, when this fails, connection limit get messed up, like the HEADERS ALREADY SENT error

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
			e= if err.body then err else new @E.ServerError err.name, err.message
			e.body.req_uuid= ctx.lamd.req_uuid
			# TODO CONFIRM / TEST THAT IT WORKS BETTER TO PASS THIS TO next() INSTEAD OF: res.send e
			ctx.lamd.statusCode= res.statusCode
			end = (new Date().getTime())
			ctx.lamd.duration = end - ctx.lamd.start
			ctx.lamd.err= @_exposeErrorProperties err
			@lamd.write ctx.lamd
			@lamd.write_deep ctx # TODO CHECK CONFIG IF WE WANT ALL STATUS CODES (LIKE 401) TO ALSO DO THIS
			@end_connection_limit()
			e.toJSON= => @_exposeErrorProperties e.body
			next e # TODO TESTING

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
				params: (_.cloneDeep req.params) , headers: req.headers, req_uuid: req._id, auth_id: 0
				conn_id: 0
		ctx.log= @lamd.GetLog ctx 
		p= ctx.p
		pre_loaded= {}
		result= false

		# 'Authorize' calls res.send so don't put this logic inside promise chain where we try to 'send' on error
		if endpoint.auth_required or endpoint.permit
			if @config.perf?.test_user_override is true and p.mock_id?
				req.auth.authId= Number p.mock_id
				req.auth.role= p.mock_role ? 'mock_role'
			else
				# Authorize calls res.send so don't put this logic inside promise change where we try to 'send' on error
				return next() if not req.auth.authorize()
				# Now req.auth.{authId,role} now set

			# TODO NEED TO STANDARIZE ON A LOCATION FOR THE POSSIBLE RICH SET OF AUTH VALUES (POSSIBLY NOT ALWAYS FROM A TOKEN, MAYBE DB?)
			# TODO LAMD LOGIC HERE MIGHT NEED BETTER STRATEGY WHEN TOKENS HAVE ARBITRARY KEYS ADDED VIA /AUTH
			pre_loaded.auth_id= ctx.auth_id= ctx.lamd.auth_id= req.auth.authId
			pre_loaded.role   = ctx.role=    ctx.lamd.role   = req.auth.role

		Promise.resolve().bind @
		.then ->
			# Validate permissions (using only the token) against 'endpoint' prior to consuming ANY resources (to avoid DoS)
			accessDeniedError = (message) => throw new @E.AccessDenied "#{f} #{message}"
			if endpoint.domain then accessDeniedError('INVALID DOMAIN') unless req.auth.token.domain is endpoint.domain
			if endpoint.roles
				roles = req.auth.role
				accessDeniedError('MISSING ROLE') if !roles or roles.length is 0 or !Array.isArray roles
				role = (aRole for aRole in roles when aRole in endpoint.roles)
				accessDeniedError('INVALID ROLE') if role.length is 0

			@start_connection_limit() # Keep this below any logic that might return before end_* is called
			ctx.lamd.request_count= request_count
			ctx.lamd.request_count_high= request_count_high

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
			ctx.lamd.conn_id= c.__pool_id
			throw new @E.ServerError f + 'BadHandle:' + JSON.stringify @_exposeErrorProperties ctx.conn._protocol._fatalError if ctx.conn isnt null and ctx.conn._protocol._fatalError isnt null
			# Start a Transaction
			return false unless endpoint.sql_tx is true
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
			throw new @E.ServerError f + 'BadHandle:' + JSON.stringify @_exposeErrorProperties ctx.conn._protocol._fatalError if ctx.conn isnt null and ctx.conn._protocol._fatalError isnt null
			result= result_hash

			# Commit the transaction
			return false unless endpoint.sql_tx is true
			@sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result)->

			# Release database conn; Respond to Client
			delete ctx.pool
			@sdb.core.release ctx.conn if ctx.conn isnt null
			result.send?.req_uuid= ctx.lamd.req_uuid # TODO ASSUMES RESULT.SEND IS AN OBJECT
			res.send result.send unless endpoint.is_websock
			ctx.lamd.statusCode= res.statusCode
			end = (new Date().getTime())
			ctx.lamd.duration = end - ctx.lamd.start
			@lamd.write ctx.lamd unless endpoint.lamd is false
			@lamd.write_deep ctx unless endpoint.lamd is false # TODO CHECK CONFIG IF WE WANT 200'S TO ALSO LOG THIS
			@end_connection_limit()
			next()

		.catch (err)->
			delete ctx.pool
			if err.statusCode not in [ 400, 403 ]
				req.log.error f, '.catch', err, err.stack
			else
				req.log.debug f, '.catch', err
			if ctx.conn isnt null
				if endpoint.sql_tx isnt true
					@sdb.core.release ctx.conn
				else
					ctx.conn.query 'ROLLBACK', (err)=>
						if err
							req.log.warn f, 'destroy db conn (failed rollback)'
							@sdb.core.destroy ctx.conn
							req.log.error f, '.catch', err.stack
						else
							req.log.debug f, 'release db conn (successful rollback)'
							@sdb.core.release ctx.conn
			e= if err.body then err else new @E.ServerError err.name, err.message
			e.body.req_uuid= ctx.lamd.req_uuid
			# TODO CONFIRM / TEST THAT IT WORKS BETTER TO PASS THIS TO next() INSTEAD OF: res.send e
			ctx.lamd.statusCode= res.statusCode
			end = (new Date().getTime())
			ctx.lamd.duration = end - ctx.lamd.start
			ctx.lamd.err= @_exposeErrorProperties err
			@lamd.write ctx.lamd
			@lamd.write_deep ctx # TODO CHECK CONFIG IF WE WANT ALL STATUS CODES (LIKE 401) TO ALSO DO THIS
			@end_connection_limit()
			e.toJSON= => @_exposeErrorProperties e.body
			next e # TODO TESTING

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
