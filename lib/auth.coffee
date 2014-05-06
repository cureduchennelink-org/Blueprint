#
# Authentication Services
# 

Q= require 'q'
E= require '../lib/error'
crypto= require 'crypto'

ITERATIONS= 150000
SALT_SIZE= 16
KEY_LENGTH= 32

sdb= false # MySql DB

class Auth
	constructor: (kit) ->
		sdb= 		kit.services.db.mysql
		@log= 		kit.services.logger
		@config= 	kit.services.config.auth
		@tokenMgr= 	kit.services.tokenMgr

	_pbkdf2: (p,buf,IT,KL)-> (Q.ninvoke crypto, 'pbkdf2', p, buf, IT, KL)

	# server.use function
	parseAuthorization: (req, res, next)=>
		p= req.params
		h= req.headers
		authHeader= false
		token= false
		result= false

		authHeader= h.authorization.split ' ', 2 if h.authorization
		token= if authHeader?.length is 2 and authHeader[0].toLowerCase() is 'bearer'
		then authHeader[1]
		else p.auth_token

		result= if token
		then @tokenMgr.decodeAndValidate token, @config.key
		else err: 'Missing or invalid authorization header'

		req.auth=
			message: result.err
			token: result.token
			authId: if result.token then result.token.iid else null
			authorize: (skip_response)->
				if not req.auth.authId
					return false if skip_response
					error= new E.OAuthError 401, 'invalid_token', req.auth.message
					res.setHeader 'WWW-Authenticate', "Bearer realm=\"blueprint\""
					res.send error
					return next()
				else true
		next()

	validateCredentials: (ctx, username, password)->
		f= 'Auth:_validateCredentials:'
		_log= ctx.log ? @log
		creds= false

		Q.resolve()
		.then ->
			
			# Grab User Credentials
			sdb.auth.get_auth_credentials ctx, username
		.then (db_rows)=>
			_log.debug 'got credentials:', db_rows
			if db_rows.length isnt 1 or not db_rows[0].pwd
				throw new E.OAuthError 401, 'invalid_client'
			creds= db_rows[0]

			# Compare given password to stored hash password
			@comparePassword password, creds.pwd
		.then (a_match)->
			_log.debug 'got a match:', a_match
			throw new E.OAuthError 401, 'invalid_client' if not a_match

			creds.id


	comparePassword: (password, compareHash)->
		f= 'Auth:_comparePassword:'
		parts= compareHash.split '.', 2
		throw new E.ServerError 'auth_error','Missing salt on password hash' if parts.length isnt 2

		(@_pbkdf2 password, new Buffer(parts[0], 'base64'), ITERATIONS, KEY_LENGTH)
		.then (key)=>
			return if (new Buffer(key).toString 'base64') is parts[1] then true else false

	encryptPassword: (password)->
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

exports.Auth= Auth