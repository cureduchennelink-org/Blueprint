Promise= require 'bluebird'
_= require 'lodash'

class GenericService
	@deps= services:[ 'config', 'error', ], config: ''
	constructor: (kit) ->
		f= 'GenericService::constructor'
		@log= 		kit.services.logger.log
		@E= 		kit.services.error
		@config=	kit.services.config.tropo

		# Caller would use set query string with e.g. action=create
		###
		@base_opts= _.merge
			json: true # request-promise package will parse the response for us
			url: @config.ApiUrl # To be appended to by caller
			headers: {}
		,@config.options
		###
		@log.debug f, @

	# A successful service
	Success: (job)=>
		f= 'GenericService::Success:'
		e= f
		@log.debug f, {job}
		@log.debug f+'JSON', JSON.parse job.json
		success: true

	# A successful service, with repeat
	Repeat: (job)=>
		f= 'GenericService::Repeat:'
		e= f
		@log.debug f, {job}
		@log.debug f+'JSON', JSON.parse job.json
		success: true, replace: json: job.json, run_at: [20, 's']

	# A failing service
	Fail: (job)=>
		f= 'GenericService::Fail:'
		e= f
		@log.debug f, {job}
		@log.debug f+'JSON', JSON.parse job.json
		throw new Error 'What a terrible failure'

	# A service that fails on the first pass then succeeds
	FailThenSucceed: (job)=>
		f= 'GenericService::FailThenSucceed:'
		e= f
		@log.debug f, {job}
		@log.debug f+'JSON', JSON.parse job.json
		if job.retries
			success: true
		else
			throw new Error 'What a terrible failure'

exports.GenericService= GenericService
