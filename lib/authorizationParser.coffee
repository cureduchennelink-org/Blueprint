#
#	Authorization Parser
#

Q= require 'q'
E= require './error'

class AuthParser
	constructor: (@config, @tokenMgr, @log)->

	parseAuthorization: (req, res, next)->
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
			authId: if result.token then result.token.uid else null
			authorize: (dontSendResponse)->
				if not req.auth.authId
					if not dontSendResponse
						error= new E.OAuthError 401, 'invalid_token', req.auth.message
						res.setHeader 'WWW-Authenticate', "Bearer realm=\"blueprint\""
						res.send error
						return next()
					else return false
				else true
		next()

exports.AuthParser= AuthParser