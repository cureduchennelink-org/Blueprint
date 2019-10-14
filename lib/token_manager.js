#
#	Token Manager
#
Promise= require 'bluebird'
crypto = require 'crypto'
moment = require 'moment'

# Some Utility Functions
urlSafeBase64DecodeFix= (str)->
	str.replace(/-/g, '+').replace(/_/g, '/')

urlSafeBase64EncodeFix= (str)->
	str.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '')

class TokenMgr
	@deps= services: []
	constructor: (kit)->
		@CreateToken=( Promise.promisify @createToken).bind @

	createToken: (length, callback)->
		crypto.randomBytes length, (err, buf)->
			return callback(err) if err
			callback null, urlSafeBase64EncodeFix buf.toString 'base64'

	encode: (token, exp, key)->
		token.exp= if moment.isMoment(exp) then exp.unix() else moment(exp).unix()
		data= urlSafeBase64EncodeFix new Buffer(JSON.stringify(token), 'utf8').toString 'base64'
		hmac= crypto.createHmac 'sha256', key
		hmac.update data
		data + '.' + urlSafeBase64EncodeFix hmac.digest 'base64'

	decodeAndValidate: (rawToken, key)->
		# Validate Token Structure
		parts= rawToken.split '.', 2
		return error: 'Bad Format' if parts.length isnt 2

		# Validate Token Signature
		hmac= crypto.createHmac 'sha256', key
		hmac.update parts[0]
		sig= urlSafeBase64EncodeFix hmac.digest 'base64'
		return error: 'Bad Signature' if sig isnt parts[1]

		# Validate Token Expiration
		token= JSON.parse (new Buffer (urlSafeBase64DecodeFix parts[0]), 'base64').toString 'utf8'
		if (isNaN token.exp) or token.exp < moment().unix()
			return error: 'Token Expired'

		token: token

exports.TokenMgr= TokenMgr
