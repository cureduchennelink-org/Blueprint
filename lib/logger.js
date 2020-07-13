// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// 	Logger Object
//

const bunyan=  require('bunyan');

class Logger {
	static deps() {
		return {services: ['config']};
	}
	constructor(kit){
		this.server_use = this.server_use.bind(this);
		this.config= kit.services.config;
		this.log= bunyan.createLogger(this.config.log);
		this.log.info('Logger Initialized...');
	}

	server_use(req, res, next) {
		if (this.config.log_opts != null ? this.config.log_opts.no_route_logs : undefined) { return next(); }
		req.log.info('ROUTE:', req.method, req.url);
		for (let nm in req.params) { const val = req.params[nm]; if (!['_'].includes(nm)) { req.log.info('PARAM:', nm + ':', val); } }
		return next();
	}
}

exports.Logger= Logger;
