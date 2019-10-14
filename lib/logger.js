/*
 * decaffeinate suggestions:
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// 	Logger Object
//

const bunyan=  require('bunyan');

class Logger {
	static initClass() {
		this.deps= {services: ['config']};
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
Logger.initClass();

exports.Logger= Logger;
