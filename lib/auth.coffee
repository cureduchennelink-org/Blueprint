#
# Authentication Services
#
Promise= require 'bluebird'
###
{pbkdf2, randomBytes}= require 'crypto'
crypto=
	pbkdf2: Promise.promisify pbkdf2
	randomBytes: Promise.promisify randomBytes
###
crypto= require 'crypto'
crypto.p_pbkdf2=		Promise.promisify crypto.pbkdf2,		context: crypto
crypto.p_randomBytes=	Promise.promisify crypto.randomBytes,	context: crypto

class Auth
	@deps=
		services: ['error', 'config', 'tokenMgr']
		config: ['auth[key,bearer,basic.api_keys,pbkdf2[iterations,salt_size,key_length]]']
		mysql: ['auth']
	constructor: (kit) ->
		@sdb= 		kit.services.db.mysql
		@E=			kit.services.error
		@config= 	kit.services.config.auth
		@tokenMgr= 	kit.services.tokenMgr
		@pwd_col= 	@sdb.auth.pwd_col
		@ITERATIONS= @config.pbkdf2.iterations
		@SALT_SIZE= 	@config.pbkdf2.salt_size
		@KEY_LENGTH= @config.pbkdf2.key_length

	_pbkdf2: (p,buf,IT,KL)-> crypto.p_pbkdf2 p, buf, IT, KL, 'sha1'

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
		else error: 'Missing or invalid authorization header'

		req.auth=
			message: result.error
			token: result.token
			authId: if result.token then result.token.iid else null
			tenant: if result.token then result.token.itenant else null
			role:   if result.token then result.token.irole else null
			authorize: (skip_response)=>
				if not req.auth.authId
					return false if skip_response
					error= new @E.OAuthError 401, 'invalid_token', req.auth.message
					res.setHeader 'WWW-Authenticate', "Bearer realm=\"#{@config.bearer}\""
					res.send error
					return false
				else true
		next()

	# Requires server.use restify.authorizationParser()
	# 	- config: restify: handlers: ['authorizationParser']
	# returns true or 'error_string'
	# Add api_keys to config: auth: basic: api_keys: my_key: password: 'myPassword'
	AuthenticateBasicAuthHeader: (req)->
		f= 'Auth:AuthenticateBasicAuthHeader:'
		auth= req.authorization
		api_keys= @config.basic.api_keys
		return 'invalid_scheme' unless auth.scheme is 'Basic'
		return 'invalid_api_key' unless auth.basic?.username of api_keys
		return 'invalid_password' unless auth.basic?.password is api_keys[auth.basic.username]?.password
		return true

	ValidateCredentials: (ctx, username, password)->
		f= 'Auth:_ValidateCredentials:'
		creds= false

		Promise.resolve().bind @
		.then ->

			# Grab User Credentials
			@sdb.auth.GetAuthCreds ctx, username
		.then (db_rows)->
			if db_rows.length isnt 1 or not db_rows[0][@pwd_col]
				throw new @E.OAuthError 401, 'invalid_client'
			creds= db_rows[0]

			# Compare given password to stored hash password
			@ComparePassword password, creds[@pwd_col]
		.then (a_match)->
			throw new @E.OAuthError 401, 'invalid_client' if not a_match
			id: creds.id, tenant: creds.tenant, role: creds.role # Encodable in auth token


	ComparePassword: (password, compareHash)->
		f= 'Auth:ComparePassword:'
		parts= compareHash.split '.', 2
		throw new @E.ServerError 'auth_error','Missing salt on password hash' if parts.length isnt 2

		(@_pbkdf2 password, new Buffer(parts[0], 'base64'), @ITERATIONS, @KEY_LENGTH)
		.then (key)->
			return if (new Buffer(key).toString 'base64') is parts[1] then true else false

	EncryptPassword: (password)->
		saltBuf= false

		Promise.resolve().bind @
		.then ->

			# Create Salt
			crypto.p_randomBytes @SALT_SIZE
		.then (buffer)->
			saltBuf= buffer

			# Encrypt Password
			@_pbkdf2 password, saltBuf, @ITERATIONS, @KEY_LENGTH
		.then (key)->
			return (saltBuf.toString 'base64') + '.' + new Buffer(key).toString 'base64'

exports.Auth= Auth
