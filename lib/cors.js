/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const corsMiddleware= require('restify-cors-middleware');

class CORS {
	static initClass() {
		this.deps = {services: ['config', 'server']};
	}
	constructor(kit){
		this.cors= corsMiddleware(kit.services.config.restify.CORS);
	}

	server_init(kit){
		const {
            server
        } = kit.services.server;
		server.pre(this.cors.preflight);
		return server.use(this.cors.actual);
	}
}
CORS.initClass();

exports.CORS= CORS;

