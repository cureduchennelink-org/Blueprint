#
# Linkedin Service
#

Promise = require 'bluebird'
request = require 'request-promise'
querystring = require 'querystring'

class LinkedinService
	@deps = services: ['error', 'logger', 'auth', 'config']
	constructor: (kit)->
		@E = kit.services.error
		@log = kit.services.logger.log
		@auth = kit.services.auth
		@config = kit.services.config

	get_access_token: (ctx, authorization_code)=>
		f = 'LinkedinService:_get_access_token'
		_log = ctx.log
		data = querystring.stringify
			grant_type: 'authorization_code'
			code: authorization_code
			redirect_uri: @config.ses.options.urlPrefix + "/linkedinreturn"
			client_id: @config.linkedin.client_id
			client_secret: @config.linkedin.client_secret
		opts = {
			uri: 'https://www.linkedin.com/oauth/v2/accessToken'
			method: 'POST'
			headers: {
				'Content-Length': Buffer.byteLength data
			}
			json: true
			form: data
		}
		_log.debug f, opts
		request(opts).then (data)->
			_log.debug data
			data
		.catch (e)=>
			@handleErrors ctx, e


	get_linkedin_user: (ctx, accessToken)=>
		f = 'LinkedinService:_get_linkedin_user'
		opts = {
			uri: 'https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))'
			method: 'GET'
			headers: {
				Connection: 'Keep-Alive'
				Authorization: 'Bearer ' + accessToken
			}
			json: true
		}

		@log.debug f, opts
		request(opts).then (data)=>
			@log.debug f, { data }
			data
		.catch (e)=>
			@handleErrors ctx, e

	get_linkedin_user_email: (ctx, accessToken)=>
		f = 'LinkedinService:get_linkedin_user_email'
		opts = {
			uri: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))'
			method: 'GET'
			headers: {
				Connection: 'Keep-Alive'
				Authorization: 'Bearer ' + accessToken
			}
			json: true
		}
		@log.debug f, opts
		request(opts).then (data)=>
			@log.debug f, { data }
			data
		.catch (e)=>
			@handleErrors ctx, e

	handleErrors: (ctx, e)->
		f= "LinkedinService::handleErrors"
		ctx.log.error f, {e}
		throw new @E.ServerError f, e

exports.LinkedinService = LinkedinService
