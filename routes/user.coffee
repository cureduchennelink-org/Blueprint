#
# User Routes
#
# Author: Jamie Hollowell
#
# @param db
# @param log
#

Q= require 'q'

odb= false

caller=
	get:		name: 'user_get', 	 auth_required: true, load_user: true
	create: 	name: 'user_create', auth_required: true
	
class User
	constructor: (db, wrapper, log)->
		log.info 'Initializing User Routes...'
		odb= db

		# Public I/F
		@get= wrapper.read_wrap caller.get, @_get
		@createUser= wrapper.update_wrap caller.create, @_create
	
	# Private Logic
	_get: (conn, p, pre_loaded, _log)->
		f= route: 'user_get'
		_log.debug f, p
		
		Q.resolve()
		.then ->
			send: pre_loaded.user
			
	_create: (conn, p, pre_loaded, _log)->
		f= 'User.createUser:'
		_log.debug f, p
		
		Q.resolve()
		.then ->

			if not p.email or not p.password
				throw new Error "Missing e-mail or password"
			
			odb.user.create conn, p.first_name, p.last_name, p.email, p.password
		.then (success)->
			_log.debug 'got create user success:', success
			send: SUCCESS: true
			
exports.User= User