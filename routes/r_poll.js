//
// Long Poll Route
//
//	POST {api_prefix}/Poll
//		@param: state - Object that is round tripped back to the client;
//		@param: listen - Object that contains the push handles interested in
//		or
//		@param: JSON: {"state:{}","listen":{"nm":{c:36,h:"1/18"}, ... }}
//
//	The Endpoint will respond to the client if any changes occur on the push handles
//	given within the "listen" param. Push Handles are given to the Client through
//	a GET method of some data-set. e.g. GET /Todo

class LongPoll {
	static deps() {
		return {services:[ 'error', 'logger', 'config', 'PollManager', ],config: 'api[longPollTimeout,authReqForPoll]'};
	}
	constructor(kit){
		const _log= 		kit.services.logger.log;
		this.E= 			kit.services.error;
		this.config= 		kit.services.config;
		this.pollMgr= 		kit.services.PollManager;
		this.setTimeout= 	(kit.services.test != null ? kit.services.test.mock_setTimeout : undefined) || setTimeout;
		this.long_timeout= 	this.config.api.longPollTimeout;
		this.safe_timeout= 	this.long_timeout + 5000;
		_log.info('Setting LongPoll Timeout to:', this.long_timeout);

		this.endpoints= {
			poll: {
				verb: 'post', route: '/Poll',
				use: true, wrap: 'simple_wrap', version: { any: this.LongPollRequest.bind( this) },
				auth_required: this.config.api.authReqForPoll
			}
		};
	}

	LongPollRequest( req, res, next) {
		const use_doc= {
			params: { state:'{}', listen: '{}', no_wait: '(optional)"truthy" for no-wait' },
			response: { state: '{}', listen: '{}', sync: '{}' }
		};
		if (req === 'use') { return use_doc; } // TODO CHECK IF WRAP-SIMPLE EVEN SUPPORTS 'use'
		const f= 'LongPoll:_LongPollRequest:';
		const _log= req.log;
		const p= req.params;

		// Validate a few Params
		for (let arg of ['state','listen']) {
			if (!(arg in p)) { res.send(new this.E.MissingArg(arg)); return next(); }
		};
		const isWait= p.no_wait? false: true;
		_log.debug( f,{ state: p.state, listen: p.listen, isWait});

		// Plan for a long poll socket/request
		// Most browsers will kill the session after 30 mins.
		// We'll send something sooner, but need to locally enforce a close
		req.connection.pause();
		req.connection.setTimeout( this.safe_timeout); // Allow unlimited http-keepalive requests

		// Hand off request to Poll Manager
		const obj= this.pollMgr.AddPoller( p.state, p.listen, this.long_timeout, ( type, response)=> {
			// Callback 'type' is initial (after first in-memory check, no recods), timeout, or haveRecords (with sync records)
			if( type=== 'initial' && isWait) return; // Wait for records or 'timeout'
			req.connection.resume();
			res.send( response); // TODO CONFIRM This calls req.on(close)
		});

		// Clean up request, if unexpected close
		req.on('close', () => this.pollMgr.PollerClosed( obj));
		return next();
	}
}

exports.LongPoll= LongPoll;

