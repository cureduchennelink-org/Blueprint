#
# Authentication Route Logic
#

Q= require 'q'
E= require '../lib/error'
crypto= require 'crypto'
moment= require 'moment'

ITERATIONS= 150000
SALT_SIZE= 16
KEY_LENGTH= 32

sdb= false # MySql DB

class AuthRoute
	constructor: (kit)->
		@log= 		kit.services.logger.log
		sdb= 		kit.services.db.mysql
		@ses= 		kit.services.ses
		@auth= 		kit.services.auth
		@config= 	kit.services.config.auth
		@tripMgr=	kit.services.tripMgr
		@tokenMgr= 	kit.services.tokenMgr

		# Authentication  Endpoints
		@endpoints=
			authenticate:
				verb: 'post', route: '/Auth'
				use: true, wrap: 'auth_wrap', version: any: @_authenticate
			update_password:
				verb: 'put', route: '/Auth/:auid/updatepassword'
				use: true, wrap: 'default_wrap', version: any: @_update_password
				sql_conn: true, sql_tx: true, auth_required: true
			update_email:
				verb: 'post', route: '/Auth/:auid/updateemail'
				use: true, wrap: 'default_wrap', version: any: @_update_email
				sql_conn: true, sql_tx: true, auth_required: true
			forgot_password:
				verb: 'post', route: '/AuthChange'
				use: true, wrap: 'default_wrap', version: any: @_forgot_password
				sql_conn: true, sql_tx: true
			read_auth_trip:
				verb: 'get', route: '/AuthChange/:token'
				use: true, wrap: 'default_wrap', version: any: @_get_auth_trip
				sql_conn: true
			verify_forgot:
				verb: 'post', route: '/AuthChange/:token/verifyforgot'
				use: true, wrap: 'default_wrap', version: any: @_verify_forgot
				sql_conn: true, sql_tx: true
			verify_email:
				verb: 'post', route: '/AuthChange/:token/verifyemail'
				use: true, wrap: 'default_wrap', version: any: @_verify_email
				sql_conn: true, sql_tx: true

	# Create Table for email template
	make_tbl: (recipient, token)->
		Trip: [ {token} ]
		Recipient: [ email: recipient.eml ]

	# POST /Auth
	_authenticate: (ctx, pre_loaded)=>
		use_doc= 
			params: client_id: 'r:S', username: 'r:S', password: 'r:S', grant_type:'r:S'
			response:
				access_token: 'string'
				token_type: 'string'
				expires_in: 'number - seconds'
				refresh_token: 'string'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		_log= ctx.log

		f= 'Auth:_authenticate:'
		_log.debug f, p, pre_loaded
		current_token= false
		new_token= false
		result= {}

		Q.resolve()
		.then =>

			# Validate Caller Credentials if requesting password
			return false unless p.grant_type is 'password'
			@auth.validateCredentials ctx, p.username, p.password
		.then (auth_ident_id)->
			_log.debug f, 'got auth_ident_id:', auth_ident_id
			result.auth_ident_id= auth_ident_id if auth_ident_id isnt false

			# Validate Refresh Token if requesting refresh_token
			return false unless p.grant_type is 'refresh_token'
			sdb.token.find_token ctx, p.refresh_token
		.then (valid_token)=>
			_log.debug f, 'got valid token:', valid_token
			if valid_token isnt false
				throw new E.OAuthError 401, 'invalid_client' if valid_token.length is 0
				result.auth_ident_id= valid_token[0].ident_id

			# Generate new refresh token
			@tokenMgr.CreateToken 16
		.then (token)=>
			new_token= token

			# Store new token, remove old token
			current_token= p.refresh_token if p.grant_type is 'refresh_token'
			exp= (moment().add 'seconds', @config.refreshTokenExpiration).toDate()
			sdb.token.update_active_token ctx, result.auth_ident_id, p.client_id, exp, new_token, current_token
		.then (refreshToken)=>

			# Generate Access Token
			exp= moment().add 'seconds', @config.accessTokenExpiration
			accessToken= @tokenMgr.encode {iid: result.auth_ident_id}, exp, @config.key

			# Return back to Client
			send:
				access_token: accessToken
				token_type: 'bearer'
				expires_in: @config.accessTokenExpiration
				refresh_token: refreshToken

	# POST /Auth/:auid/updateemail
	_update_email: (ctx, pre_loaded)=>
		use_doc=
			params: new_eml: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		# Verify p.usid is the same as the auth_id. Validate params.
		throw new E.AccessDenied 'AUTH:UPDATE_EMAIL:AUTH_ID' unless (Number p.auid) is pre_loaded.auth_id
		throw new E.MissingArg 'new_eml' if not p.new_eml

		f= 'User:_update_email:'

		Q.resolve()
		.then =>

			# Verify email doesn't already exist
			sdb.auth.get_by_cred_name ctx, p.new_eml
		.then (db_rows)=>
			_log.debug 'got ident with new_eml:', db_rows
			throw new E.AccessDenied 'AUTH:UPDATE_EMAIL:EMAIL_EXISTS' unless db_rows.length is 0

			# Create Trip and store email in json info
			@tripMgr.planTrip ctx, pre_loaded.auth_id, { eml: p.new_eml }, null, 'update_email'
		.then (new_trip)=>
			_log.debug f, 'got round trip:', new_trip
			trip= new_trip

			# Send 'Verify Email' email
			recipient= eml: p.new_eml
			@ses.send 'verify_email_change', @make_tbl(recipient, trip.token)
		.then ()->
			success= true

			# Send back to Client
			send: { success }

	# POST /AuthTrip/:token/verifyemail
	_verify_email: (ctx, pre_loaded)=>
		use_doc= params: {}, response: success: 'bool'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		_log= ctx.log
		trip= false
		ident= false
		new_eml= false

		f= 'Auth:_verify_email:'

		Q.resolve()
		.then =>

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)=>
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new E.AccessDenied 'AUTH:VERIFY_EMAIL:INVALID_TOKEN' if bad_token
			throw new E.AccessDenied 'AUTH:VERIFY_EMAIL:INVALID_DOMAIN' if trip.domain isnt 'update_email'
			new_eml= (JSON.parse trip.json).eml

			# Grab existing ident record
			sdb.auth.get_by_id ctx, trip.auth_ident_id
		.then (db_rows)=>
			_log.debug 'got ident:', db_rows
			throw new E.NotFoundError 'AUTH:VERIFY_EMAIL:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]

			# Verify email doesn't already exist
			sdb.auth.get_by_cred_name ctx, new_eml
		.then (db_rows)=>
			_log.debug 'got ident with new_eml:', db_rows
			throw new E.AccessDenied 'AUTH:VERIFY_EMAIL:EMAIL_EXISTS' unless db_rows.length is 0

			# Update the ident email
			sdb.auth.update_by_id ctx, ident.id, eml: new_eml
		.then (db_result)=>
			_log.debug f, 'got password update result:', db_result
			throw new E.DbError 'AUTH:VERIFY_EMAIL:AFFECTEDROWS' if db_result.affectedRows isnt 1

			# Return the Trip to the Trip Manager
			@tripMgr.returnFromTrip ctx, trip.id
		.then ()=>

			# Send 'Email Confirmed' email
			recipient= eml: new_eml
			@ses.send 'email_change_confirmed', @make_tbl(recipient)
		.then ()->
			success= true

			# Send back to Client
			send: { success }

	# POST/PUT /Auth/:auid/updatepassword
	_update_password: (ctx, pre_loaded)=>
		use_doc=
			params: new_pwd: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		# Verify p.usid is the same as the auth_id. Validate params.
		throw new E.AccessDenied 'AUTH:UPDATE_PASSWORD:AUTH_ID' unless (Number p.auid) is pre_loaded.auth_id
		throw new E.MissingArg 'new_pwd' if not p.new_pwd

		f= 'User:_update_password:'

		Q.resolve()
		.then =>

			# Encrypt the new password
			@auth.encryptPassword p.new_pwd
		.then (pwd_hash)->

			# Update the ident password
			sdb.auth.update_by_id ctx, pre_loaded.auth_id, pwd: pwd_hash
		.then (db_result)->
			_log.debug f, 'got password update result:', db_result
			throw new E.DbError 'AUTH:UPDATE_PASSWORD:AFFECTEDROWS' if db_result.affectedRows isnt 1
			success= true

			# Send back to Client
			send: { success }

	# POST /AuthTrip
	_forgot_password: (ctx, pre_loaded)=>
		use_doc=
			params: email: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		_log= ctx.log
		ident= false

		# Validate params.
		throw new E.MissingArg 'email' if not p.email

		f= 'Auth:_forgot_password:'

		Q.resolve()
		.then =>

			# Grab Ident Credentials
			sdb.auth.get_by_cred_name ctx, p.email
		.then (db_rows)=>
			_log.debug 'got ident:', db_rows
			throw new E.NotFoundError 'AUTH:FORGOT_PASSWORD:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]

			# Plan a Round Trip
			@tripMgr.planTrip ctx, ident.id, {}, null, 'forgot_password'
		.then (new_trip)=>
			_log.debug f, 'got round trip:', new_trip
			trip= new_trip if new_trip isnt false

			# Send Forgot Email Password
			@ses.send 'forgot_password', @make_tbl(ident, trip.token)
		.then ()->
			success= true

			# Send back to Client
			send: { success }

	# POST /AuthTrip/:token/verifyforgot
	_verify_forgot: (ctx, pre_loaded)=>
		use_doc=
			params: new_pwd: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		_log= ctx.log
		trip= false
		success= false

		f= 'Auth:_verify_forgot:'

		# Verify the params
		throw new E.MissingArg 'new_pwd' if not p.new_pwd

		Q.resolve()
		.then =>

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)=>
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new E.AccessDenied 'AUTH:AUTH_TRIP:INVALID_TOKEN' if bad_token
			throw new E.AccessDenied 'AUTH:AUTH_TRIP:INVALID_DOMAIN' if trip.domain isnt 'forgot_password'

			# Encrypt the new password
			@auth.encryptPassword p.new_pwd
		.then (pwd_hash)->

			# Update the ident password
			sdb.auth.update_by_id ctx, trip.auth_ident_id, pwd: pwd_hash
		.then (db_result)=>
			_log.debug f, 'got password update result:', db_result
			throw new E.DbError 'AUTH:UPDATE_PASSWORD:AFFECTEDROWS' if db_result.affectedRows isnt 1

			# Return the Trip to the Trip Manager
			@tripMgr.returnFromTrip ctx, trip.id
		.then ()->
			success= true

			# Send back to Client
			send: { success }

	# GET  /AuthTrip/:token
	_get_auth_trip: (ctx, pre_loaded)=>
		use_doc=
			params: {}
			response: ident: 'object'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		_log= ctx.log
		bad_token= false
		trip= false
		ident= false

		f= 'Auth:_auth_trip:'

		Q.resolve()
		.then =>

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)=>
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new E.AccessDenied 'AUTH:AUTH_TRIP:BAD_TOKEN' if bad_token

			# Retrieve Ident Info
			sdb.auth.get_by_id ctx, trip.auth_ident_id
		.then (db_rows)=>
			_log.debug 'got ident:', db_rows
			throw new E.NotFoundError 'AUTH:AUTH_TRIP:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]
			ident.token= trip.token

			# Send back to Client
			send: { ident }

	# Preload the Auth Ident
	_pl_ident: (ctx)->
		f= 'Auth:_pl_ident:'
		ctx.log.debug f, ctx.p

		Q.resolve().then ->

			# Retrieve Ident Info
			sdb.auth.get_by_id ctx, ctx.auth_id
		.then (db_rows)=>
			ctx.log.debug 'got ident:', db_rows
			throw new E.NotFoundError 'AUTH:PRELOAD:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]

exports.AuthRoute= AuthRoute
