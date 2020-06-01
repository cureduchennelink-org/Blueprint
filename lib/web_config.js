/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Offer up dynamic config.js for web apps, based on config:web: document
//

class WebConfig {
	static initClass() {
		this.deps= {services: ['config','logger'], config: 'web.config_document', server: true};
	}
	constructor(kit){
		this.server_start = this.server_start.bind(this);
		const f = 'WebConfig:constructor';
		this.config = kit.services.config.web;
		this.log = kit.services.logger.log;
	}


	// Runs before server starts listening
	server_start(kit){
		const f = 'WebConfig:server_start:';
		const {
            server
        } = kit.services.server;

		const path= '/config.js'; // JCS: Restify now only like strings here
		this.log.debug(f, `Adding GET ${path}`);
		return server.get(path, (req, res, next) => {
			res.header('Content-Type', 'text/plain');
			res.send(200, this.config.config_document);
			return next;
		});
	}
}
WebConfig.initClass();

exports.WebConfig = WebConfig;
