#
# Long Poll Route
#
#	POST {api_prefix}/Poll
#		@param: state - Object that is round tripped back to the client;
#		@param: listen - Object that contains the push handles interested in
#		or
#		@param: JSON: {"state:{}","listen":{"nm":"1/18/36", ... }}
#
#	The Endpoint will respond to the client if any changes occur on the push handles
#	given within the "listen" param. Push Handles are given to the Client through
#	a GET method of some data-set. e.g. GET /Todo

E= require '../lib/error'
_= require 'lodash'

_log= false

class LongPoll
	@deps= services:[ 'logger', 'config', 'push', 'pollMgr', ],config: 'api[longPollTimeout,authReqForPoll]'
	constructor: (kit)->
		_log= 		 	kit.services.logger.log
		@config= 	 	kit.services.config
		@push= 		 	kit.services.push
		@pollMgr= 	 	kit.services.pollMgr
		@setTimeout= 	kit.services.test?.mock_setTimeout or setTimeout
		@long_timeout= 	@config.api.longPollTimeout
		@safe_timeout= 	@long_timeout + 5000
		_log.info 'Setting LongPoll Timeout to:', @long_timeout
		@endpoints=
			poll:
				verb: 'post', route: '/Poll'
				use: true, wrap: 'simple_wrap', version: any: @LongPollRequest
				auth_required: @config.api.authReqForPoll

	LongPollRequest: (req,res,next) =>
		use_doc=
			params: state:'{}', listen: '{}'
			response: state: '{}', listen: '{}', sync: '{}'
		return use_doc if req is 'use'
		f= 'LongPoll:_LongPollRequest:'
		_log= req.log
		p= req.params
		id= req.id()

		# Validate a few Params
		for arg in ['state','listen']
			(res.send new E.MissingArg arg; return next()) unless arg of p
		_log.debug f, 'state:',p.state,'listen:',p.listen

		# Plan for a long poll socket/request
		# Most browsers will kill the session after 30 mins.
		# We'll send something sooner, but need to locally enforce a close
		req.connection.pause()
		req.connection.setTimeout @safe_timeout # Allow unlimited http-keepalive requests
		req.on 'close', => # Clean up request, if unexpected close
			@pollMgr.PollerClosed id

		# Hand off request to Poll Manager
		@pollMgr.AddPoller id, req, res, p.listen, p.state, @long_timeout

		# Move on
		next()

exports.LongPoll= LongPoll

