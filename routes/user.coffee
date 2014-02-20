#
# User Routes
#
# Author: Jamie Hollowell
#
# @param db
# @param log
#

Q= require 'q'
E= require '../lib/error'

odb= false # Mongo DB
sdb= false # MySql DB

caller=
	get:		name: 'user_get', 	 sql_conn: true, auth_required: true, load_user: true
	create: 	name: 'user_create', sql_conn: true, auth_required: true

class User
	constructor: (db, wrapper, log)->
		log.info 'Initializing User Routes...'
		odb= db.mongo
		sdb= db.mysql

		# Public I/F
		@get= wrapper.read_wrap caller.get, @_get
		@createUser= wrapper.update_wrap caller.create, @_create

	# Private Logic
	_get: (conn, p, pre_loaded, _log)->
		f= route: 'user_get'
		_log.debug f, p

		Q.resolve()
		.then ->
			send:
				success: true
				user: pre_loaded.user

	_create: (conn, p, pre_loaded, _log)->
		f= 'User.createUser:'
		_log.debug f, p

		throw new E.InvalidArg 'Invalid Email', param: 'email' if not p.email
		throw new E.InvalidArg 'Invalid Password', param: 'password' if not p.password

		Q.resolve()
		.then ->

			sdb.user.create conn, p.first_name, p.last_name, p.email, p.password
		.then (db_result)->
			_log.debug 'got create user success:', success
			send: success: true

exports.User= User