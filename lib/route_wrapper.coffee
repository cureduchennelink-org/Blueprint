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

class Wrapper
	constructor: (kit) ->
		kit.logger.log.info 'Initializing Route Wrappers...'
		_log= kit.logger.log
		odb= kit.db.mongo
		sdb= kit.db.mysql
		pre_loader= kit.pre_loader

	auth_wrap: (logic)->
		auth_func= @auth
		return (q,s,n)-> auth_func q, s, n, logic

	read_wrap: (caller, logic)->
		read_func= @read
		return (q,s,n)-> read_func q, s, n, caller, logic

	update_wrap: (caller, logic)->
		update_func= @update
		return (q,s,n)-> update_func q, s, n, caller, logic

	auth: (req, res, next, route_logic)->
		f= "Wrapper:auth"
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

	read: (req, res, next, caller, route_logic) ->
		f= "Wrapper:read:#{caller.name}"
		conn= null
		p= req.params
		pre_loaded= {}

		Q.resolve()
		.then ->

			# Acquire DB Connection
			return false unless caller.sql_conn
			sdb.core.Acquire()
		.then (c) ->
			conn= c if c isnt false

			# Pre Load User
			return false unless caller.load_user
			pre_loader.load_user conn, p.usid
		.then (user) ->
			req.log.debug 'got pre_loaded user:', f, user
			pre_loaded.user= user

			# Call the Route Logic. Pass in pre_loaded variables
			route_logic conn, req.params, pre_loaded, req.log
		.then (result_hash) ->

			# Release database conn; Respond to Client
			sdb.core.release conn if conn isnt null
			res.send result_hash.send
			next()
		.fail (err) ->
			req.log.error f, '.fail', err, err.stack
			res.send err
			next()

	update: (req, res, next, caller, route_logic) ->
		f= "Wrapper:update:#{caller.name}"
		conn= null
		result= false
		pre_loaded= {}

		if caller.auth_required
			return next() if not req.auth.authorize()

		Q.resolve()
		.then ->

			# Acquire DB Connection and start a Transaction
			return false unless caller.sql_conn
			sdb.core.AcquireTxConn()
		.then (c) ->
			conn= c if c isnt false

			# Pre Load User
			return false unless caller.load_user
			pre_loader.load_user conn, p.usid
		.then (user) ->
			req.log.debug f, 'got pre_loaded user:', user
			pre_loaded.user= user

			# Call the Route Logic. Pass in pre_loaded variables
			route_logic conn, req.params, pre_loaded, req.log
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