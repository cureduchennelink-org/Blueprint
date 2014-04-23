#
# Auth Route
#
# Author: Jamie Hollowell
#
# 	kit dependencies:
#		config.auth
#		tokenMgr
#		db
#		wrapper
#		logger.log.[info,debug]
#

Q= require 'q'
E= require '../lib/error'
crypto= require 'crypto'

ITERATIONS= 150000
SALT_SIZE= 16
KEY_LENGTH= 32

sdb= false # MySql DB

class AuthRoute
	constructor: (kit)->
		kit.services.logger.log.info 'Initializing Auth Routes...'
		@config= kit.services.config.auth
		@tokenMgr= kit.services.tokenMgr
		sdb= kit.services.db.mysql
		@log= kit.services.logger.log
		@endpoints=
			authenticate:
				verb: 'post', route: '/Auth'
				use: true, wrap: 'auth_wrap', version: any: @_authenticate
			update_password:
				verb: 'put', route: '/Auth/:auid/updatepassword'
				use: true, wrap: 'update_wrap', version: any: @_update_password
				sql_conn: true, auth_required: true

	# POST/PUT /Auth/:auid/updatepassword
	_update_password: (conn, p, pre_loaded, _log)=>
		use_doc= new_pwd: 'S'
		return use_doc if conn is 'use'

		# Verify p.usid is the same as the auth_id. Validate params.
		throw new E.AccessDenied 'AUTH:UPDATE_PASSWORD:AUTH_ID' unless (Number p.auid) is pre_loaded.auth_id
		throw new E.MissingArg 'new_pwd' if not p.new_pwd

		f= 'User:_update_password:'

		Q.resolve()
		.then =>

			# Encrypt the new password
			@_encryptPassword p.new_pwd
		.then (pwd_hash)->

			# Update the ident password
			sdb.auth.update_by_id conn, pre_loaded.auth_id, pwd: pwd_hash
		.then (db_result)->
			_log.debug f, 'got password update result:', db_result
			throw new E.DbError 'AUTH:UPDATE_PASSWORD:AFFECTEDROWS' if db_result.affectedRows isnt 1

			# Send back to Client
			send: success: true

	# POST /Auth
	_authenticate: (conn, p, pre_loaded, _log)=>
		use_doc= client_id: 'rS', username: 'rS', password: 'rS', grant_type:'S'
		return use_doc if conn is 'use'

		f= 'Auth:_authenticate:'
		_log.debug f, p, pre_loaded
		clearToken= false
		result= {}

		Q.resolve()
		.then =>

			# Validate Caller Credentials if requesting password
			return false unless p.grant_type is 'password'
			@_validateCredentials conn, p.username, p.password, _log
		.then (auth_ident_id)->
			_log.debug f, 'got auth_ident_id:', auth_ident_id
			result.auth_ident_id= auth_ident_id if auth_ident_id isnt false

			# Validate Refresh Token if requesting refresh_token
			return false unless p.grant_type is 'refresh_token'
			sdb.token.find_token conn, p.refresh_token
		.then (valid_token)=>
			_log.debug f, 'got valid token:', valid_token
			if valid_token isnt false
				throw new E.OAuthError 401, 'invalid_client' if valid_token.length is 0
				result.auth_ident_id= valid_token[0].ident_id

			# Generate Refresh Token
			clearToken= p.refresh_token if p.grant_type is 'refresh_token'
			_log.debug 'got clearToken:', clearToken
			exp= (moment().add 'seconds', @config.refreshTokenExpiration).toDate()
			sdb.token.create_ident_token conn, result.auth_ident_id, p.client_id, exp, clearToken
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

	_validateCredentials: (conn, username, password, _log)->
		f= 'Auth:_validateCredentials:'
		_log= @log if not _log
		creds= false

		Q.resolve()
		.then ->

			# Grab User Credentials
			sdb.auth.get_auth_credentials conn, username
		.then (credentials)=>
			_log.debug 'got credentials:', credentials
			creds= credentials

			# Compare given password to stored hash password
			@_comparePassword password, creds.pwd
		.then (a_match)->
			_log.debug 'got a match:', a_match
			throw new E.OAuthError 401, 'invalid_client' if not a_match

			creds.id

	_pbkdf2: (p,buf,IT,KL)-> (Q.ninvoke crypto, 'pbkdf2', p, buf, IT, KL)

	_comparePassword: (password, compareHash)->
		f= 'Auth:_comparePassword:'
		parts= compareHash.split '.', 2
		throw new E.ServerError 'auth_error','Missing salt on password hash' if parts.length isnt 2

		(@_pbkdf2 password, new Buffer(parts[0], 'base64'), ITERATIONS, KEY_LENGTH)
		.then (key)=>
			return if (new Buffer(key).toString 'base64') is parts[1] then true else false

	_encryptPassword: (password)->
		saltBuf= false

		Q.resolve()
		.then ->

			# Create Salt
			Q.ninvoke crypto, 'randomBytes', SALT_SIZE
		.then (buffer)=>
			saltBuf= buffer

			# Encrypt Password
			@_pbkdf2 password, saltBuf, ITERATIONS, KEY_LENGTH
		.then (key)->
			return (saltBuf.toString 'base64') + '.' + new Buffer(key).toString 'base64'


exports.AuthRoute= AuthRoute
