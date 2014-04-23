#
#	Route Wrapper
#	- Pre Loader
#	- Error Handler
#
#	kit dependencies:
#		logger.log.[debug,info]
#		db.[mysql,mongo]
#		pre_loader

Q= require 'q'
E= require './error'

_log= false
odb= false
sdb= false
pre_loader= false
routes= false

class Wrapper
	constructor: (kit) ->
		kit.services.logger.log.info 'Initializing Route Wrappers...'
		_log= kit.services.logger.log
		odb= kit.services.db.mongo
		sdb= kit.services.db.mysql
		@routes= kit.routes
		@router= kit.services.router
		@wraps= {}

	add_wrap: (mod, wrap)=>
		@wraps[mod]= wrap

	add: (mod)=>
		return @wraps[mod] mod if mod of @wraps
		for func, endpoint of @routes[mod].endpoints
			endpoint.name= mod+':'+func
			wrap= @[endpoint.wrap] endpoint
			@router.add_route endpoint.verb, endpoint.route, wrap

	auth_wrap: (caller)->
		auth_func= @auth
		return (q,s,n)-> auth_func q, s, n, caller

	read_wrap: (caller)->
		read_func= @read
		return (q,s,n)-> read_func q, s, n, caller

	update_wrap: (caller)->
		update_func= @update
		return (q,s,n)-> update_func q, s, n, caller

	auth: (req, res, next, caller)->
		f= "Wrapper:auth"
		route_logic= caller.version[req.params?.Version] ? caller.version.any
		return (if caller.use isnt true then caller.use else route_logic req) if req is 'use'
		conn= null
		p= req.params
		pre_loaded= {}
		send_result= false
		supported_grant_type= if p.grant_type in ['password','refresh_token'] then true else false

		Q.resolve()
		.then ->

			# Validate client_id and grant_type
			throw new E.OAuthError 400, 'unauthorized_client' if not p.client_id
			throw new E.OAuthError 400, 'unsupported_grant_type' if not supported_grant_type

			# Acquire DB Connection and start a Transaction
			sdb.core.AcquireTxConn()
		.then (c) ->
			conn= c

			# Call the Auth Logic. Pass in pre_loaded variables
			route_logic conn, p, pre_loaded, req.log
		.then (result_hash) ->
			send_result= result_hash.send

			# Commit the transaction
			sdb.core.sqlQuery conn, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			sdb.core.release conn if conn isnt null
			res.send send_result
			next()

		.fail (err) ->
			if err.statusCode not in [ 400, 401, 403 ]
				req.log.error f, '.fail', err, err.stack
			else
				req.log.debug f, '.fail', err
			if err.body and err.body.error is 'invalid_client'
				res.setHeader 'WWW-Authenticate', 'Bearer realm="blueprint"' # TODO: Put realm in config file
			if conn isnt null
				conn.query 'ROLLBACK', (err)->
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						sdb.core.destroy conn
						req.log.error f, '.fail', err.stack
					else
						req.log.debug f, 'release db conn (successful rollback)'
						sdb.core.release conn
			res.send err
			next()

	read: (req, res, next, caller) ->
		f= "Wrapper:read:#{caller.name}"
		route_logic= caller.version[req.params?.Version] ? caller.version.any
		return (if caller.use isnt true then caller.use else route_logic req) if req is 'use'
		conn= null
		p= req.params
		pre_loaded= {}

		if caller.auth_required
			return next() if not req.auth.authorize()
			pre_loaded.auth_id= req.auth.authId

		Q.resolve()
		.then ->

			# Acquire DB Connection
			return false unless caller.sql_conn
			sdb.core.Acquire()
		.then (c) ->
			conn= c if c isnt false

			# Loop through the caller's pre_load functions
			q_result = Q.resolve true
			for nm,func of caller.pre_load
				do (nm,func) ->
					q_result= q_result.then () ->
						func conn, p
					.then (pre_load_result) ->
						_log.debug "got #{nm}:", pre_load_result
						pre_loaded[nm]= pre_load_result
			q_result
		.then ->

			# Call the Route Logic. Pass in pre_loaded variables
			route_logic conn, p, pre_loaded, req.log
		.then (result_hash) ->

			# Release database conn; Respond to Client
			sdb.core.release conn if conn isnt null
			res.send result_hash.send
			next()
		.fail (err) ->
			if err.statusCode not in [ 400, 403 ]
				req.log.error f, '.fail', err, err.stack
			else
				req.log.debug f, '.fail', err
			res.send err
			next()

	update: (req, res, next, caller) ->
		f= "Wrapper:update:#{caller.name}"
		route_logic= caller.version[req.params?.Version] ? caller.version.any
		return (if caller.use isnt true then caller.use else route_logic req) if req is 'use'
		conn= null
		result= false
		p= req.params
		pre_loaded= {}

		if caller.auth_required
			return next() if not req.auth.authorize()
			pre_loaded.auth_id= req.auth.authId

		Q.resolve()
		.then ->

			# Acquire DB Connection and start a Transaction
			return false unless caller.sql_conn
			sdb.core.AcquireTxConn()
		.then (c) ->
			conn= c if c isnt false

			# Loop through the caller's pre_load functions
			q_result = Q.resolve true
			for nm,func of caller.pre_load
				do (nm,func) ->
					q_result= q_result.then () ->
						func conn, p
					.then (pre_load_result) ->
						_log.debug "got #{nm}:", pre_load_result
						pre_loaded[nm]= pre_load_result
			q_result
		.then ->

			# Call the Route Logic. Pass in pre_loaded variables
			route_logic conn, p, pre_loaded, req.log
		.then (result_hash) ->
			result= result_hash

			# Commit the transaction
			return false unless caller.sql_conn
			sdb.core.sqlQuery conn, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			sdb.core.release conn if conn isnt null
			res.send result.send
			next()

		.fail (err) ->
			if err.statusCode not in [ 400, 403 ]
				req.log.error f, '.fail', err, err.stack
			else
				req.log.debug f, '.fail', err
			if conn isnt null
				conn.query 'ROLLBACK', (err)->
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						sdb.core.destroy conn
						req.log.error f, '.fail', err.stack
					else
						req.log.debug f, 'release db conn (successful rollback)'
						sdb.core.release conn
			res.send err
			next()

exports.Wrapper= Wrapper