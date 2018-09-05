#
# Registration Routes
#

Promise= require 'bluebird'
moment = require('moment');

class Registration
	@deps= services:[ 'error', 'config', 'ses', 'auth', 'tripMgr', 'template', ], mysql:[ 'auth', 'user', ], config: 'ses.options,api.ident_id'
	constructor: (kit)->
		@E=			kit.services.E
		@config=	kit.services.config
		@sdb=		kit.services.db.mysql
		@ses=		kit.services.ses
		@auth=		kit.services.auth
		@tripMgr=	kit.services.tripMgr
		@template=	kit.services.template

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
			#Implemented on TIB project
			#register_signup:
			#	verb: 'post', route: '/Signup/:token/register'
			#	use: true, wrap: 'default_wrap', version: any: @_register_signup
			#	sql_conn: true, sql_tx: true, auth_required: false

	# Create Table for email template
	make_tbl: (recipient, token, options)->
		Trip: [ {token} ]
		Recipient: [ recipient ]
		Opt: [ options ]

	# Private Logic
	_signup: (ctx, pre_loaded)=>
		use_doc=
			params: fnm: 'r:S', lnm: 'r:S', eml: 'r:S', role: 'r:S [vendor | executive]'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		p= ctx.p
		recipient= false
		success= false

		f= 'Registration:_signup:'

		# Validate a few Params
		throw new @E.MissingArg 'eml' if not p.eml
		throw new @E.MissingArg 'fnm' if not p.fnm
		throw new @E.MissingArg 'lnm' if not p.lnm
		throw new @E.MissingArg 'role' if not p.role

		Promise.resolve().bind @
		.then ->

			# Verify email doesn't already exist
			@sdb.auth.GetByCredName ctx, p.eml
		.then (db_rows)->
			ctx.log.debug 'got ident with eml:', db_rows
			throw new @E.AccessDenied 'REGISTER:SIGNUP:EMAIL_EXISTS' unless db_rows.length is 0

			# Create Trip and store email, fnm, lnm in json info. Never Expires (null).
			expires = 3 #expires in three days
			expireDate = moment().add(expires, 'days').format();
			@tripMgr.planTrip ctx, @config.api.ident_id, { eml: p.eml, fnm: p.fnm, lnm: p.lnm, role: p.role }, expireDate, 'signup'
		.then (new_trip)->
			ctx.log.debug f, 'got signup round trip:', new_trip
			trip= new_trip

			# Send Signup email
			recipient= eml: p.eml, fnm: p.fnm, lnm: p.lnm
			@ses.send 'verify_signup', @make_tbl recipient, trip.token, @config.ses.options
		.then ()->
			success= true

			# Send back to Client
			send: { success , recipient}

	_read_signup: (ctx, pre_loaded)=>
		use_doc= params: {}, response: success: 'bool', signup: 'JSON'
		return use_doc if ctx is 'use'
		p= ctx.p
		trip= false
		success= false

		f= 'Registration:_read_signup:'

		Promise.resolve().bind @
		.then ->

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)->
			ctx.log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new @E.AccessDenied 'REGISTER:READ_SIGNUP:BAD_TOKEN' if bad_token
			trip.json= JSON.parse trip.json

			# Verify email doesn't already exist
			@sdb.auth.GetByCredName ctx, trip.json.eml
		.then (db_rows)->
			ctx.log.debug 'got ident with eml:', db_rows
			throw new @E.AccessDenied 'REGISTER:READ_SIGNUP:EMAIL_EXISTS' unless db_rows.length is 0
			success= true

			# Return trip json info
			send: { success, signup: trip.json}

	_register_signup: (ctx, pre_loaded)=>
		use_doc=
			params: fnm: 'r:S', lnm: 'r:S', eml: 'r:S', pwd: 'r:S'
			response: success: 'bool', eml_change: 'bool'
		return use_doc if ctx is 'use'
		f= 'Registration:_register_signup:'
		p= ctx.p
		trip= false
		change_trip= false
		eml= p.eml
		eml_change= false
		new_ident_id= false
		new_pwd= ''
		success= false

		# Validate a few params
		throw new @E.MissingArg 'eml' if not p.eml
		throw new @E.MissingArg 'pwd' if not p.pwd
		throw new @E.MissingArg 'fnm' if not p.fnm
		throw new @E.MissingArg 'lnm' if not p.lnm


		Promise.resolve().bind @
		.then ->

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)->
			ctx.log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new @E.AccessDenied 'REGISTER:REGISTER_SIGNUP:BAD_TOKEN' if bad_token
			trip.json= JSON.parse trip.json
			eml_change= eml isnt trip.json.eml

			# Verify email doesn't already exist
			@sdb.auth.GetByCredName ctx, eml
		.then (db_rows)->
			ctx.log.debug f, 'got ident with eml:', db_rows
			throw new @E.AccessDenied 'REGISTER:REGISTER_SIGNUP:EMAIL_EXISTS' unless db_rows.length is 0
			success= true

			# Encrypt the new password
			@auth.EncryptPassword p.pwd
		.then (pwd_hash)->
			new_pwd= pwd_hash

			# Insert Ident Record
			new_ident= eml: trip.json.eml, pwd: new_pwd
			@sdb.auth.Create ctx, new_ident
		.then (db_result)->
			throw new @E.DbError 'REGISTER:REGISTER_SIGNUP:CREATE_IDENT' if db_result.affectedRows isnt 1
			new_ident_id= db_result.insertId

			# TODO: FRAMEWORK: HOW TO HOOK IN TO THE EXTENDED PROFILE TABLE?
			# Insert User/Profile Record
			new_profile= ident_id: new_ident_id, fnm: p.fnm, lnm: p.lnm
			@sdb.user.Create ctx, new_profile
		.then (db_result)->
			throw new @E.DbError 'REGISTER:REGISTER_SIGNUP:CREATE_PROFILE' if db_result.affectedRows isnt 1

			# Return the Trip to the Trip Manager
			@tripMgr.returnFromTrip ctx, trip.id, new_ident_id
		.then ()->

			# Send Signup Complete Email
			return false if eml_change
			recipient= email: p.eml, fnm: p.fnm, lnm: p.lnm
			@ses.send 'signup_complete', @make_tbl(recipient)
		.then ()->

			# Create Trip and store email in json info
			return false unless eml_change
			@tripMgr.planTrip ctx, new_ident_id, { eml: eml }, null, 'update_email'
		.then (new_trip)->
			ctx.log.debug f, 'got round trip:', new_trip
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
