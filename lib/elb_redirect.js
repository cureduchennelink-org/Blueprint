// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Static Redirect Route Service
//


class ELBRedirect {
	static initClass() {
		this.deps= {services:[ 'logger', 'server']};
	}
	constructor(kit){
		this.server_start = this.server_start.bind(this);
		const f= 'ELBRedirect:constructor';
		this.log= 	kit.services.logger.log;
	}

	// Runs before server starts listening
	server_start(kit){
		const f= 'ELBRedirect:server_start:';
		const {
            server
        } = kit.services.server;

		return server.use((req, res, next)=> {
			if ((req.method === 'GET') && (req.headers['x-forwarded-proto'] === 'http')) {
				const path = 'https://' + req.header('host') + req.href();
				this.log.debug(f, {method: req.method, header: req.headers['x-forwarded-proto'], path});
				res.setHeader('location', path);
				return res.send(302);
			} else {
				return next();
			}
		});
	}
}
ELBRedirect.initClass();

exports.ELBRedirect= ELBRedirect;
