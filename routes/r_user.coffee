#
# User Routes
#
# Author: Jamie Hollowell
#
# 	kit dependencies:
#		db.[mysql,mongo]
#		wrapper
#		logger.log
#

Q= require 'q'
E= require '../lib/error'

odb= false # Mongo DB
sdb= false # MySql DB

caller=
	get:		name: 'user:get', 	 sql_conn: true, auth_required: true, load_user: true
	create: 	name: 'user:create', sql_conn: true, auth_required: true

class User
	constructor: (kit)->
		kit.logger.log.info 'Initializing User Routes...'
		odb= kit.db.mongo
		sdb= kit.db.mysql

		# Public I/F
		@get= kit.wrapper.read_wrap caller.get, @_get
		@createUser= kit.wrapper.update_wrap caller.create, @_create

	# Private Logic
	_get: (conn, p, pre_loaded, _log)->
		f= 'User:_get:'

		Q.resolve()
		.then ->
			send:
				success: true
				users: [pre_loaded.user]

	_create: (conn, p, pre_loaded, _log)->
		f= 'User:_create:'

		throw new E.InvalidArg 'Invalid Email','email' if not p.email
		throw new E.InvalidArg 'Invalid Password','password' if not p.password

		Q.resolve()
		.then ->

			# Insert the User in to the Database. Validated for affectedRows=1
			sdb.user.create conn, p.first_name, p.last_name, p.email, p.password
		.then (db_result)->

			send: success: true

exports.User= User