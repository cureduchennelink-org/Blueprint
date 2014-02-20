#
#	Route Wrapper
#	- Pre Loader
#	- Error Handler
#

Q= require 'q'
E= require './error'

_log= false
odb= false
pre_loader= false

class Wrapper
	constructor: (db, pl, log) ->
		_log= log
		_log.info 'Initializing Route Wrappers...'
		odb= db
		pre_loader= pl

	read_wrap: (caller, logic)->
		read_func= @read
		return (q,s,n)-> read_func q, s, n, caller, logic

	update_wrap: (caller, logic)->
		update_func= @update
		return (q,s,n)-> update_func q, s, n, caller, logic

	read: (req, res, next, caller, route_logic) ->
		f= wrapper: "Read:#{caller.name}"
		conn= null
		p= req.params
		pre_loaded= {}

		Q.resolve()
		.then ->

			# Acquire DB Connection
			return false unless caller.sql_conn
			odb.mysql.core.Acquire()
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

			# Release database conn; Respond to Client
			odb.mysql.core.release conn if conn isnt null
			res.send result_hash.send
			next()
		.fail (err) ->
			req.log.error f, '.fail', err, err.stack
			res.send err
			next()

	update: (req, res, next, caller, route_logic) ->
		f= wrapper: 'update', caller: caller.name
		conn= null
		result= false
		pre_loaded= {}

		if caller.auth_required
			req.log.debug f, 'auth_required is not implemented'

		Q.resolve()
		.then ->

			# Acquire DB Connection
			return false unless caller.sql_conn
			odb.mysql.core.Acquire()
		.then (c) ->
			conn= c if c isnt false

			# Initialize the transaction
			return false unless caller.sql_conn
			sql= 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
			odb.mysql.core.sqlQuery conn, sql
		.then (db_result) ->

			# Start the transaction
			return false unless caller.sql_conn
			sql= 'START TRANSACTION'
			odb.mysql.core.sqlQuery conn, sql
		.then (db_result) ->

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
			odb.mysql.core.sqlQuery conn, 'COMMIT'
		.then (db_result) ->

			# Release database conn; Respond to Client
			odb.mysql.core.release conn if conn isnt null
			res.send result.send
			next()

		.fail (err) ->
			req.log.error f, '.fail', err, err.stack
			if conn isnt null
				conn.query 'ROLLBACK', (err)->
					if err
						req.log.warn f, 'destroy db conn (failed rollback)'
						odb.mysql.core.destroy conn
						req.log.error f, '.fail', err.stack
					else
						req.log.info f, 'release db conn (successful rollback)'
						odb.mysql.core.release conn
			res.send err
			next()

	_check_auth: ()->
		true

exports.Wrapper= Wrapper