// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Long Poll Route
//
//	POST {api_prefix}/Poll
//		@param: state - Object that is round tripped back to the client;
//		@param: listen - Object that contains the push handles interested in
//		or
//		@param: JSON: {"state:{}","listen":{"nm":"1/18/36", ... }}
//
//	The Endpoint will respond to the client if any changes occur on the push handles
//	given within the "listen" param. Push Handles are given to the Client through
//	a GET method of some data-set. e.g. GET /Todo

const E= require('../lib/error');
const _= require('lodash');

let _log= false;

class LongPoll {
	static initClass() {
		this.deps= {services:[ 'logger', 'config', 'push', 'pollMgr', ],config: 'api[longPollTimeout,authReqForPoll]'};
	}
	constructor(kit){
		this.LongPollRequest = this.LongPollRequest.bind(this);
		_log= 		 	kit.services.logger.log;
		this.config= 	 	kit.services.config;
		this.push= 		 	kit.services.push;
		this.pollMgr= 	 	kit.services.pollMgr;
		this.setTimeout= 	(kit.services.test != null ? kit.services.test.mock_setTimeout : undefined) || setTimeout;
		this.long_timeout= 	this.config.api.longPollTimeout;
		this.safe_timeout= 	this.long_timeout + 5000;
		_log.info('Setting LongPoll Timeout to:', this.long_timeout);
		this.endpoints= {
			poll: {
				verb: 'post', route: '/Poll',
				use: true, wrap: 'simple_wrap', version: { any: this.LongPollRequest
			},
				auth_required: this.config.api.authReqForPoll
			}
		};
	}

	LongPollRequest(req,res,next) {
		const use_doc= {
			params: { state:'{}', listen: '{}'
		},
			response: { state: '{}', listen: '{}', sync: '{}'
		}
		};
		if (req === 'use') { return use_doc; }
		const f= 'LongPoll:_LongPollRequest:';
		_log= req.log;
		const p= req.params;
		const id= req.id();

		// Validate a few Params
		for (let arg of ['state','listen']) {
			if (!(arg in p)) { res.send(new E.MissingArg(arg)); return next(); }
		}
		_log.debug(f, 'state:',p.state,'listen:',p.listen);

		// Plan for a long poll socket/request
		// Most browsers will kill the session after 30 mins.
		// We'll send something sooner, but need to locally enforce a close
		req.connection.pause();
		req.connection.setTimeout(this.safe_timeout); // Allow unlimited http-keepalive requests
		req.on('close', () => { // Clean up request, if unexpected close
			return this.pollMgr.PollerClosed(id);
		});

		// Hand off request to Poll Manager
		this.pollMgr.AddPoller(id, req, res, p.listen, p.state, this.long_timeout);

		// Move on
		return next();
	}
}
LongPoll.initClass();

exports.LongPoll= LongPoll;

