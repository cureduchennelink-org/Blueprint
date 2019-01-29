//
// 	Logger Object
//

const bunyan=  require('bunyan');

class Logger {
	constructor(kit){
		const { config }= kit.services;
		this.log= bunyan.createLogger(config.log);
		this.log.info('Logger Initialized...');
	}

	server_use(req, res, next) {
		req.log.info('ROUTE:', req.method, req.url);
		for (let nm in req.params) { const val = req.params[nm]; if (!['_'].includes(nm)) { req.log.info('PARAM:', nm + ':', val); } }
		return next();
	}
}

exports.Logger= Logger;