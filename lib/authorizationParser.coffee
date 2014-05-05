#
#	Authorization Parser
#
#	kit dependencies:
#		config.auth.key

Q= require 'q'
E= require './error'

class AuthParser
	constructor: (kit)->
		kit.services.logger.log.info 'Initializing Authorization Parser...'
		@config= 	kit.services.config.auth
		@tokenMgr= 	kit.services.tokenMgr
		@log= 		kit.services.logger.log

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

exports.AuthParser= AuthParser