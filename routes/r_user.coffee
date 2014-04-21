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
_log= false

ident_tbl= 'ident'
extnd_tbl= 'profile'

class User
	constructor: (kit)->
		kit.logger.log.info 'Initializing User Routes...'
		odb= kit.db.mongo
		sdb= kit.db.mysql
		_log= kit.logger.log
		@caller=
			get:
				use: true, wrap: 'read_wrap', version: any: @_get
				sql_conn: true, auth_required: true, load_user: true
				pre_load: user: @_pl_user
			create:
				use: true, wrap: 'update_wrap', version: any: @_create
				sql_conn: true, auth_required: true

	# Private Logic
	_get: (conn, p, pre_loaded, _log)->
		use_doc= {}
		return use_doc if conn is 'use'

		f= 'User:_get:'

		Q.resolve()
		.then ->
			send:
				success: true
				users: [pre_loaded.user]

	_create: (conn, p, pre_loaded, _log)->
		use_doc= email: 'S', password: 'S'
		return use_doc if conn is 'use'

		f= 'User:_create:'

		throw new E.InvalidArg 'Invalid Email','email' if not p.email
		throw new E.InvalidArg 'Invalid Password','password' if not p.password

		Q.resolve()
		.then ->

			# Insert the User in to the Database. Validated for affectedRows=1
			sdb.user.create conn, p.first_name, p.last_name, p.email, p.password
		.then (db_result)->

			send: success: true

	# Pre loader Func
	_pl_user: (conn, p)->
		f= 'User:_pl_user:'
		_log.debug f, p
		Q.resolve().then ->

			# TODO: Add this to the DB DOA
			sql= 'SELECT * FROM ' + ident_tbl + ' i LEFT OUTER JOIN ' + extnd_tbl + ' e' +
				' ON i.id= e.ident_id WHERE i.id= ? AND i.di= 0 AND e.di= 0'
			sdb.core.sqlQuery conn, sql, [100]
		.then (db_rows) ->
			_log.debug 'got here!', db_rows
			throw new E.NotFoundError 'User' if db_rows.length isnt 1
			db_rows

exports.User= User