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
		kit.logger.log.info 'Initializing Auth Route...'
		@config= kit.config.auth
		@tokenMgr= kit.tokenMgr
		sdb= kit.db.mysql
		@log= kit.logger.log

		# Public I/F
		@authenticate= kit.wrapper.auth_wrap @_authenticate

	_authenticate: (conn, p, pre_loaded, _log)=>
		f= route: 'Auth', fn: 'authenticate'
		_log.debug f, p, pre_loaded
		clearToken= false
		result= {}

		Q.resolve()
		.then =>

			# Validate Caller Credentials if requesting password
			return false unless p.grant_type is 'password'
			@_validateCredentials conn, p.username, p.password, _log
		.then (auth_user_id)->
			_log.debug f, 'got auth_user_id:', auth_user_id
			result.auth_user_id= auth_user_id if auth_user_id isnt false

			# Validate Refresh Token if requesting refresh_token
			return false unless p.grant_type is 'refresh_token'
			sdb.token.find_token conn, p.refresh_token
		.then (valid_token)=>
			_log.debug f, 'got valid token:', valid_token
			if valid_token isnt false
				throw new E.OAuthError 401, 'invalid_client' if valid_token.length is 0
				result.auth_user_id= valid_token[0].user_id

			# Generate Refresh Token
			clearToken= p.refresh_token if p.grant_type is 'refresh_token'
			_log.debug 'got clearToken:', clearToken
			exp= (moment().add 'seconds', @config.refreshTokenExpiration).toDate()
			sdb.token.createRefreshToken conn, result.auth_user_id, p.client_id, exp, clearToken
		.then (refreshToken)=>

			# Generate Access Token
			exp= moment().add 'seconds', @config.accessTokenExpiration
			accessToken= @tokenMgr.encode {uid: result.auth_user_id}, exp, @config.key

			# Return back to Client
			send:
				access_token: accessToken
				token_type: 'bearer'
				expires_in: @config.accessTokenExpiration
				refresh_token: refreshToken

	_validateCredentials: (conn, username, password, _log)->
		f= route: 'Auth', fn: '_validateCredentials'
		_log= @log if not _log
		creds= false

		Q.resolve()
		.then ->

			# Grab User Credentials
			sdb.user.get_auth_credentials conn, username
		.then (credentials)=>
			_log.debug 'got credentials:', credentials
			creds= credentials

			# Compare given password to stored hash password
			@_comparePassword password, creds.password
		.then (a_match)->
			_log.debug 'got a match:', a_match
			throw new E.OAuthError 401, 'invalid_client' if not a_match

			creds.id

	_pbkdf2: (p,buf,IT,KL)-> (Q.ninvoke crypto, 'pbkdf2', p, buf, IT, KL)

	_comparePassword: (password, compareHash)->
		f= route: 'Auth', fn: '_comparePassword'
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
