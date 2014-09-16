#
#	Route Wrapper Module
#

Q= require 'q'
E= require './error'

_log= false
odb= false
sdb= false
config= false

class Wrapper
	constructor: (kit) ->
		_log= 		kit.services.logger.log
		odb= 		kit.services.db.mongo
		sdb= 		kit.services.db.mysql
		config=		kit.services.config
		@routes= 	kit.routes
		@router= 	kit.services.router
		@wraps= {}

	add_wrap: (mod, wrap)=> # TOOD: See where this is used
		@wraps[mod]= wrap

	add: (mod)=>
		f= 'Wrapper:add:'
		return @wraps[mod] mod if mod of @wraps
		for func, endpoint of @routes[mod].endpoints
			endpoint.name= mod+':'+func
			wrap= @[endpoint.wrap] endpoint
			@router.add_route mod, func, endpoint.verb, endpoint.route, wrap

	auth_wrap: (caller)->
		auth_func= @auth
		return (q,s,n)-> auth_func q, s, n, caller

	default_wrap: (caller)->
		func= @default
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

	auth: (req, res, next, caller)->
		f= "Wrapper:auth"
		throw new E.ServerError 'WRAPPER:AUTH:MYSQL_NOT_ENABLED' unless config.db.mysql.enable
		route_logic= caller.version[req.params?.Version] ? caller.version.any
		return (if caller.use isnt true then caller.use else route_logic req) if req is 'use'
		ctx= conn: null, p: req.params, log: req.log
		p= ctx.p
		pre_loaded= {}
		send_result= false
		supported_grant_type= if p.grant_type in ['password','refresh_token'] then true else false

		Q.resolve()
		.then ->

			# Validate client_id and grant_type
			throw new E.OAuthError 400, 'unauthorized_client' if not p.client_id
			throw new E.OAuthError 400, 'unsupported_grant_type' if not supported_grant_type

			# Acquire DB Connection
			sdb.core.Acquire()
		.then (c) ->
			ctx.conn= c if c isnt false

			# Start a Transaction
			sdb.core.StartTransaction(ctx)
		.then () ->

			# Call the Auth Logic. Pass in pre_loaded variables
			route_logic ctx, pre_loaded
		.then (result_hash) ->
			send_result= result_hash.send

			# Commit the transaction
			sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			sdb.core.release ctx.conn if ctx.conn isnt null
			res.send send_result
			next()

		.fail (err) ->
			if err.statusCode not in [ 400, 401, 403 ]
				req.log.error f, '.fail', err, err.stack
			else
				req.log.debug f, '.fail', err, err.stack
			if err.body and err.body.error is 'invalid_client'
				res.setHeader 'WWW-Authenticate', "Bearer realm=#{config.auth.bearer}"
			if ctx.conn isnt null
				ctx.conn.query 'ROLLBACK', (err)->
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						sdb.core.destroy ctx.conn
						req.log.error f, '.fail', err.stack
					else
						req.log.debug f, 'release db conn (successful rollback)'
						sdb.core.release ctx.conn
			res.send err
			next()

	default: (req, res, next, endpoint) =>
		f= "Wrapper:default:#{endpoint.name}"
		route_logic= endpoint.version[req.params?.Version] ? endpoint.version.any
		return (if endpoint.use isnt true then endpoint.use else route_logic req) if req is 'use'
		ctx=
			conn: null, p: req.params
			log: req.log, auth_id: req.auth.authId
			files: req.files, req: req
		p= ctx.p
		pre_loaded= {}
		result= false

		if endpoint.auth_required or endpoint.permit
			return next() if not req.auth.authorize()
			pre_loaded.auth_id= req.auth.authId

		Q.resolve()
		.then ->

			# Acquire DB Connection
			return false unless endpoint.sql_conn
			throw new E.ServerError 'WRAPPER:DEFAULT:MYSQL_NOT_ENABLED' unless config.db.mysql.enable
			sdb.core.Acquire()
		.then (c) ->
			ctx.conn= c if c isnt false

			# Start a Transaction
			return false unless endpoint.sql_tx
			throw new E.ServerError 'WRAPPER:DEFAULT:MYSQL_NOT_ENABLED' unless config.db.mysql.enable
			sdb.core.StartTransaction(ctx)
		.then () ->

			# Loop through the endpoint's pre_load functions
			q_result = Q.resolve true
			for nm,func of endpoint.pre_load
				do (nm,func) ->
					q_result= q_result.then () ->
						func ctx, pre_loaded
					.then (pre_load_result) ->
						_log.debug f, "got #{nm}:", pre_load_result
						pre_loaded[nm]= pre_load_result
			q_result
		.then ->

			# Call the Route Logic. Pass in pre_loaded variables
			route_logic ctx, pre_loaded
		.then (result_hash) ->
			result= result_hash

			# Commit the transaction
			return false unless endpoint.sql_conn
			sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			sdb.core.release ctx.conn if ctx.conn isnt null
			res.send result.send
			next()

		.fail (err) ->
			if err.statusCode not in [ 400, 403 ]
				req.log.error f, '.fail', err, err.stack
			else
				req.log.debug f, '.fail', err
			if ctx.conn isnt null
				ctx.conn.query 'ROLLBACK', (err)->
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						sdb.core.destroy ctx.conn
						req.log.error f, '.fail', err.stack
					else
						req.log.debug f, 'release db conn (successful rollback)'
						sdb.core.release ctx.conn
			res.send err
			next()

exports.Wrapper= Wrapper