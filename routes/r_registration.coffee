#
# Registration Routes
#

Q= require 'q'
E= require '../lib/error'

sdb= false # MySql DB
_log= false

class Registration
	constructor: (kit)->
		_log= 		kit.services.logger.log
		sdb= 		kit.services.db.mysql
		@ses= 		kit.services.ses
		@auth= 		kit.services.auth
		@config= 	kit.services.config
		@tripMgr= 	kit.services.tripMgr
		@template= 	kit.services.template

		# Registration endpoints
		@endpoints=
			signup:
				verb: 'post', route: '/Signup'
				sql_conn: true, sql_tx: true, auth_required: false
				use: true, wrap: 'default_wrap', version: any: @_signup
			read_signup:
				verb: 'get', route: '/Signup/:token'
				use: true, wrap: 'default_wrap', version: any: @_read_signup
				sql_conn: true, auth_required: false
			register_signup:
				verb: 'post', route: '/Signup/:token/register'
				use: true, wrap: 'default_wrap', version: any: @_register_signup
				sql_conn: true, sql_tx: true, auth_required: false

	# Create Table for email template
	make_tbl: (recipient, token)->
		Trip: [ {token} ]
		Recipient: [ recipient ]

	# Private Logic
	_signup: (ctx, pre_loaded)=>
		use_doc=
			params: fnm: 'r:S', lnm: 'r:S', eml: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		_log= ctx.log
		p= ctx.p
		success= false

		f= 'Registration:_signup:'

		# Validate a few Params
		throw new E.MissingArg 'eml' if not p.eml
		throw new E.MissingArg 'fnm' if not p.fnm
		throw new E.MissingArg 'lnm' if not p.lnm

		Q.resolve()
		.then ->

			# Verify email doesn't already exist
			sdb.auth.get_by_cred_name ctx, p.eml
		.then (db_rows)=>
			_log.debug 'got ident with eml:', db_rows
			throw new E.AccessDenied 'REGISTER:SIGNUP:EMAIL_EXISTS' unless db_rows.length is 0

			# Create Trip and store email, fnm, lnm in json info. Never Expires (null).
			@tripMgr.planTrip ctx, @config.api.ident_id, { eml: p.eml, fnm: p.fnm, lnm: p.lnm }, null, 'signup'
		.then (new_trip)=>
			_log.debug f, 'got signup round trip:', new_trip
			trip= new_trip

			# Send Signup email
			recipient= email: p.eml, fnm: p.fnm, lnm: p.lnm
			@ses.send 'verify_signup', @make_tbl(recipient, trip.token)
		.then ()->
			success= true

			# Send back to Client
			send: { success }

	_read_signup: (ctx, pre_loaded)=>
		use_doc= params: {}, response: success: 'bool', signup: 'JSON'
		return use_doc if ctx is 'use'
		_log= ctx.log
		p= ctx.p
		trip= false
		success= false

		f= 'Registration:_read_signup:'

		Q.resolve()
		.then =>

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)=>
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new E.AccessDenied 'REGISTER:READ_SIGNUP:BAD_TOKEN' if bad_token
			trip.json= JSON.parse trip.json

			# Verify email doesn't already exist
			sdb.auth.get_by_cred_name ctx, trip.json.eml
		.then (db_rows)=>
			_log.debug 'got ident with eml:', db_rows
			throw new E.AccessDenied 'REGISTER:READ_SIGNUP:EMAIL_EXISTS' unless db_rows.length is 0
			success= true

			# Return trip json info
			send: { success, signup: trip.json}

	_register_signup: (ctx, pre_loaded)=>
		use_doc=
			params: fnm: 'r:S', lnm: 'r:S', eml: 'r:S', pwd: 'r:S'
			response: success: 'bool', eml_change: 'bool'
		return use_doc if ctx is 'use'
		_log= ctx.log
		p= ctx.p
		trip= false
		change_trip= false
		eml= p.eml
		eml_change= false
		new_ident_id= false
		new_pwd= ''
		success= false

		f= 'Registration:_register_signup:'

		# Validate a few params
		throw new E.MissingArg 'eml' if not p.eml
		throw new E.MissingArg 'pwd' if not p.pwd
		throw new E.MissingArg 'fnm' if not p.fnm
		throw new E.MissingArg 'lnm' if not p.lnm


		Q.resolve()
		.then =>

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)=>
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new E.AccessDenied 'REGISTER:REGISTER_SIGNUP:BAD_TOKEN' if bad_token
			trip.json= JSON.parse trip.json
			eml_change= eml isnt trip.json.eml

			# Verify email doesn't already exist
			sdb.auth.get_by_cred_name ctx, eml
		.then (db_rows)=>
			_log.debug f, 'got ident with eml:', db_rows
			throw new E.AccessDenied 'REGISTER:REGISTER_SIGNUP:EMAIL_EXISTS' unless db_rows.length is 0
			success= true

			# Encrypt the new password
			@auth.EncryptPassword p.pwd
		.then (pwd_hash)=>
			new_pwd= pwd_hash

			# Insert Ident Record
			new_ident= eml: trip.json.eml, pwd: new_pwd
			sdb.auth.create ctx, new_ident
		.then (db_result)=>
			throw new E.DbError 'REGISTER:REGISTER_SIGNUP:CREATE_IDENT' if db_result.affectedRows isnt 1
			new_ident_id= db_result.insertId

			# Insert User/Profile Record
			new_profile= ident_id: new_ident_id, fnm: p.fnm, lnm: p.lnm
			sdb.user.create ctx, new_profile
		.then (db_result)=>
			throw new E.DbError 'REGISTER:REGISTER_SIGNUP:CREATE_PROFILE' if db_result.affectedRows isnt 1

			# Return the Trip to the Trip Manager
			@tripMgr.returnFromTrip ctx, trip.id, new_ident_id
		.then ()=>

			# Send Signup Complete Email
			return false if eml_change
			recipient= email: p.eml, fnm: p.fnm, lnm: p.lnm
			@ses.send 'signup_complete', @make_tbl(recipient)
		.then ()=>

			# Create Trip and store email in json info
			return false unless eml_change
			@tripMgr.planTrip ctx, new_ident_id, { eml: eml }, null, 'update_email'
		.then (new_trip)=>
			_log.debug f, 'got round trip:', new_trip
			change_trip= new_trip if new_trip isnt false

			# Send 'Verify Email' email
			# TODO: Make a 'ReRegister' Endpoint so that we can send a 'Signup Complete' email on eml_change
			return false unless eml_change
			recipient= email: eml
			@ses.send 'verify_email_change', @make_tbl(recipient, change_trip.token)
		.then ()->
			success= true

			# Return success
			send: { success , eml_change }

exports.Registration= Registration
