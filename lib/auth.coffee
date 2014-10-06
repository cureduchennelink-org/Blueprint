#
# Authentication Services
#

Q= require 'q'
E= require '../lib/error'
crypto= require 'crypto'

ITERATIONS= false
SALT_SIZE= false
KEY_LENGTH= false

sdb= false # MySql DB

class Auth
	constructor: (kit) ->
		sdb= 		kit.services.db.mysql
		@log= 		kit.services.logger.log
		@config= 	kit.services.config.auth
		@tokenMgr= 	kit.services.tokenMgr
		@pwd_col= 	sdb.auth.pwd_col
		ITERATIONS= @config.pbkdf2.iterations
		SALT_SIZE= 	@config.pbkdf2.salt_size
		KEY_LENGTH= @config.pbkdf2.key_length

	_pbkdf2: (p,buf,IT,KL)-> (Q.ninvoke crypto, 'pbkdf2', p, buf, IT, KL)

	# Request Authorization Parser
	server_use: (req, res, next)=>
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
			authorize: (skip_response)=>
				if not req.auth.authId
					return false if skip_response
					error= new E.OAuthError 401, 'invalid_token', req.auth.message
					res.setHeader 'WWW-Authenticate', "Bearer realm=\"#{@config.bearer}\""
					res.send error
					return next()
				else true
		next()

	ValidateCredentials: (ctx, username, password)->
		f= 'Auth:_ValidateCredentials:'
		_log= ctx.log ? @log
		creds= false

		Q.resolve()
		.then ->

			# Grab User Credentials
			sdb.auth.get_auth_credentials ctx, username
		.then (db_rows)=>
			if db_rows.length isnt 1 or not db_rows[0][@pwd_col]
				throw new E.OAuthError 401, 'invalid_client'
			creds= db_rows[0]

			# Compare given password to stored hash password
			@ComparePassword password, creds[@pwd_col]
		.then (a_match)->
			throw new E.OAuthError 401, 'invalid_client' if not a_match
			creds.id


	ComparePassword: (password, compareHash)->
		f= 'Auth:ComparePassword:'
		parts= compareHash.split '.', 2
		throw new E.ServerError 'auth_error','Missing salt on password hash' if parts.length isnt 2

		(@_pbkdf2 password, new Buffer(parts[0], 'base64'), ITERATIONS, KEY_LENGTH)
		.then (key)=>
			return if (new Buffer(key).toString 'base64') is parts[1] then true else false

	EncryptPassword: (password)->
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