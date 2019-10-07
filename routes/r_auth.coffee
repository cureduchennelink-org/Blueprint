#
# Authentication Route Logic
#

Promise= require 'bluebird'
_= require 'lodash'
crypto= require 'crypto'
moment= require 'moment'

class AuthRoute
	@deps= services: ['error','config','logger','ses','auth','tripMgr','tokenMgr','event'], mysql: ['auth','token'] # TODO 'event' is optional
	constructor: (kit)->
		@E= 	kit.services.error
		@config= 	kit.services.config
		@log= 		kit.services.logger.log
		@ses= 		kit.services.ses
		@auth= 		kit.services.auth
		@tripMgr=	kit.services.tripMgr
		@tokenMgr= 	kit.services.tokenMgr
		@event=		kit.services.event ? emit: ->
		@sdb= 		kit.services.db.mysql

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

	make_tbl: (recipient, token, options, page_name, ctx)->
		custom= if ctx and typeof @config.ses.customize is 'function'
			@config.ses.customize ctx, page_name, recipient, token, options
		else [custom:false]
		Trip: [ {token} ]
		Recipient: [ recipient ]
		Opt: [ options ]
		Custom: custom

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
		f= 'Auth:_authenticate:'
		p= 	  ctx.p
		_log= ctx.log
		_log.debug f, p, pre_loaded
		current_token= false
		new_token= false
		need_refresh= true
		refresh_expires_in= @config.auth.refreshTokenExpiration
		access_expires_in= @config.auth.accessTokenExpiration
		result= {}

		Promise.resolve().bind @
		.then ->

			# Validate Caller Credentials if requesting password
			return false unless p.grant_type is 'password'
			@auth.ValidateCredentials ctx, p.username, p.password
		.then (ident_info)->
			_log.debug f, 'got ident_info:', ident_info
			result.auth= ident_info if ident_info isnt false

			# Validate Refresh Token if requesting refresh_token
			return false unless p.grant_type is 'refresh_token'
			@sdb.token.GetNonExpiredToken ctx, p.refresh_token
		.then (valid_token)->
			_log.debug f, 'got valid token:', valid_token
			if valid_token isnt false
				throw new @E.OAuthError 401, 'invalid_grant', 'Refresh token invalid.' if valid_token.length is 0
				result.auth= valid_token[0]

			# Validate Confidential Client if requesting client_credentials
			return false unless p.grant_type is 'client_credentials'
			throw new @E.MissingArg 'client_secret' unless p.client_secret
			@auth.ValidateCredentials ctx, p.client_id, p.client_secret
		.then (ident_info)->
			_log.debug f, 'got confidential ident_info:', ident_info
			if ident_info isnt false
				result.auth= ident_info
				need_refresh= false

			# Generate new refresh token
			return false unless need_refresh
			@tokenMgr.CreateToken 16
		.then (token)->

			# Store new token, remove old token
			return false unless need_refresh
			current_token= p.refresh_token if p.grant_type is 'refresh_token'
			exp= refresh_expires_in
			nv= {ident_id: result.auth.id, client: p.client_id, token, exp}
			@sdb.token.UpdateActiveToken ctx, nv, current_token
		.then (ident_token)->
			if ident_token isnt false
				refresh_token= ident_token.token

			# Generate Access Token
			exp= moment().add access_expires_in, 'seconds'
			i_info= iid: result.auth.id
			# These additional entries are added if exists
			i_info.itenant= result.auth.tenant if result.auth.tenant?
			i_info.irole= result.auth.role if result.auth.role?
			access_token= @tokenMgr.encode i_info, exp, @config.auth.key

			# Publish event for other modules
			@event.emit 'r_auth.login', ident_id: result.auth.id

			# Return back to Client
			send: {access_token, token_type: 'bearer', expires_in: access_expires_in, refresh_token, info: i_info}

	# POST /Auth/:auid/updateemail
	_update_email: (ctx, pre_loaded)=>
		use_doc=
			params: eml: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		f= 'Auth:_update_email:'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		# Verify p.usid is the same as the auth_id. Validate params.
		if p.auid isnt 'me'
			throw new @E.AccessDenied 'AUTH:UPDATE_EMAIL:AUTH_ID' unless (Number p.auid) is pre_loaded.auth_id
		throw new @E.MissingArg 'eml' if not p.eml

		Promise.resolve().bind @
		.then ()->

			# Verify email doesn't already exist
			@sdb.auth.GetByCredName ctx, p.eml
		.then (db_rows)->
			_log.debug 'got ident with eml:', db_rows
			throw new @E.AccessDenied 'AUTH:UPDATE_EMAIL:EMAIL_EXISTS' unless db_rows.length is 0

			# Create Trip and store email in json info
			@tripMgr.planTrip ctx, pre_loaded.auth_id, { eml: p.eml }, null, 'update_email'
		.then (new_trip)->
			_log.debug f, 'got round trip:', new_trip
			trip= new_trip

			# Send 'Verify Email' email
			recipient= eml: p.eml
			@ses.send 'verify_email_change', @make_tbl recipient, trip.token, @config.ses.options
		.then ()->
			success= true

			# Send back to Client
			send: { success }

	# POST /AuthTrip/:token/verifyemail
	_verify_email: (ctx, pre_loaded)=>
		use_doc= params: {}, response: success: 'bool'
		return use_doc if ctx is 'use'
		f= 'Auth:_verify_email:'
		p= 	  ctx.p
		_log= ctx.log
		trip= false
		ident= false
		new_eml= false

		Promise.resolve().bind @
		.then ()->

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)->
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new @E.AccessDenied 'AUTH:VERIFY_EMAIL:INVALID_TOKEN' if bad_token
			throw new @E.AccessDenied 'AUTH:VERIFY_EMAIL:INVALID_DOMAIN' if trip.domain isnt 'update_email'
			new_eml= (JSON.parse trip.json).eml

			# Grab existing ident record
			@sdb.auth.GetById ctx, trip.auth_ident_id
		.then (db_rows)->
			_log.debug 'got ident:', db_rows
			throw new @E.NotFoundError 'AUTH:VERIFY_EMAIL:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]

			# Verify email doesn't already exist
			@sdb.auth.GetByCredName ctx, new_eml
		.then (db_rows)->
			_log.debug 'got ident with new_eml:', db_rows
			throw new @E.AccessDenied 'AUTH:VERIFY_EMAIL:EMAIL_EXISTS' unless db_rows.length is 0

			# Update the ident email
			@sdb.auth.update_by_id ctx, ident.id, eml: new_eml
		.then (db_result)->
			_log.debug f, 'got password update result:', db_result
			throw new @E.DbError 'AUTH:VERIFY_EMAIL:AFFECTEDROWS' if db_result.affectedRows isnt 1

			# Return the Trip to the Trip Manager
			@tripMgr.returnFromTrip ctx, trip.id
		.then ()->

			# Send 'Email Confirmed' email
			recipient= eml: new_eml
			@ses.send 'email_change_confirmed', @make_tbl(recipient)
		.then ()->

			# Send back to Client
			success= true
			send: { success }

	# POST/PUT /Auth/:auid/updatepassword
	_update_password: (ctx, pre_loaded)=>
		use_doc=
			params: pwd: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		f= 'Auth:_update_password:'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		# Verify p.usid is the same as the auth_id. Validate params.
		if p.auid isnt 'me'
			throw new @E.AccessDenied 'AUTH:UPDATE_PASSWORD:AUTH_ID' unless (Number p.auid) is pre_loaded.auth_id
		throw new @E.MissingArg 'pwd' if not p.pwd

		Promise.resolve().bind @
		.then ()->

			# Encrypt the new password
			@auth.EncryptPassword p.pwd
		.then (pwd_hash)->

			# Update the ident password
			@sdb.auth.update_by_id ctx, pre_loaded.auth_id, pwd: pwd_hash
		.then (db_result)->
			_log.debug f, 'got password update result:', db_result
			throw new @E.DbError 'AUTH:UPDATE_PASSWORD:AFFECTEDROWS' if db_result.affectedRows isnt 1

			# Send back to Client
			success= true
			send: { success }

	# POST /AuthChange
	_forgot_password: (ctx, pre_loaded)=>
		use_doc=
			params: eml: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		f= 'Auth:_forgot_password:'
		p= 	  ctx.p
		_log= ctx.log
		ident= false

		# Validate params.
		throw new @E.MissingArg 'eml' if not p.eml

		Promise.resolve().bind @
		.then ()->

			# Grab Ident Credentials
			@sdb.auth.GetByCredName ctx, p.eml
		.then (db_rows)->
			_log.debug 'got ident:', db_rows
			throw new @E.NotFoundError 'AUTH:FORGOT_PASSWORD:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]

			# Plan a Round Trip
			@tripMgr.planTrip ctx, ident.id, {}, null, 'forgot_password'
		.then (new_trip)->
			_log.debug f, 'got round trip:', new_trip
			trip= new_trip if new_trip isnt false

			# Send Forgot Email Password
			@ses.send 'forgot_password', @make_tbl ident, trip.token, @config.ses.options, 'forgot_password', ctx
		.then ()->

			# Send back to Client
			success= true
			send: { success }

	# POST /AuthTrip/:token/verifyforgot
	_verify_forgot: (ctx, pre_loaded)=>
		use_doc=
			params: pwd: 'r:S'
			response: success: 'bool'
		return use_doc if ctx is 'use'
		f= 'Auth:_verify_forgot:'
		p= 	  ctx.p
		_log= ctx.log
		trip= false
		success= false

		# Verify the params
		throw new @E.MissingArg 'pwd' if not p.pwd

		Promise.resolve().bind @
		.then ()->

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)->
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new @E.AccessDenied 'AUTH:AUTH_TRIP:INVALID_TOKEN' if bad_token
			throw new @E.AccessDenied 'AUTH:AUTH_TRIP:INVALID_DOMAIN' if trip.domain isnt 'forgot_password'

			# Encrypt the new password
			@auth.EncryptPassword p.pwd
		.then (pwd_hash)->

			# Update the ident password
			@sdb.auth.update_by_id ctx, trip.auth_ident_id, pwd: pwd_hash
		.then (db_result)->
			_log.debug f, 'got password update result:', db_result
			throw new @E.DbError 'AUTH:UPDATE_PASSWORD:AFFECTEDROWS' if db_result.affectedRows isnt 1

			# Return the Trip to the Trip Manager
			@tripMgr.returnFromTrip ctx, trip.id
		.then ()->

			# Send back to Client
			success= true
			send: { success }

	# GET  /AuthTrip/:token
	_get_auth_trip: (ctx, pre_loaded)=>
		use_doc=
			params: {}
			response: ident: 'object'
		return use_doc if ctx is 'use'
		f= 'Auth:_auth_trip:'
		p= 	  ctx.p
		_log= ctx.log
		bad_token= false
		trip= false
		ident= false

		Promise.resolve().bind @
		.then ()->

			# Retrieve trip info from Trip Manager
			@tripMgr.getTripFromToken ctx, p.token
		.then (trip_info)->
			_log.debug f, 'got round trip:', trip_info
			trip= trip_info
			bad_token= trip_info.status is 'unknown' or trip_info.status isnt 'valid'
			throw new @E.AccessDenied 'AUTH:AUTH_TRIP:BAD_TOKEN' if bad_token

			# Retrieve Ident Info
			@sdb.auth.GetById ctx, trip.auth_ident_id
		.then (db_rows)->
			_log.debug 'got ident:', db_rows
			throw new @E.NotFoundError 'AUTH:AUTH_TRIP:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]
			ident.token= trip.token

			# Send back to Client
			send: { ident }

	# Preload the Auth Ident
	_pl_ident: (ctx)->
		f= 'Auth:_pl_ident:'
		ctx.log.debug f, ctx.p

		Promise.resolve().bind @
		.then ->

			# Retrieve Ident Info
			@sdb.auth.GetById ctx, ctx.auth_id
		.then (db_rows)->
			ctx.log.debug 'got ident:', db_rows
			throw new @E.NotFoundError 'AUTH:PRELOAD:IDENT' if db_rows.length isnt 1
			ident= db_rows[0]

exports.AuthRoute= AuthRoute
