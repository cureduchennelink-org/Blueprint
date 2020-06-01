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
		this.deps= {services:[ 'logger', 'server', 'config']};
	}
	constructor(kit){
		this.server_start = this.server_start.bind(this);
		const f= 'ELBRedirect:constructor';
		this.log= 	kit.services.logger.log;
		this.config= kit.services.config;
		this.host= this.config.api.host;
		this.port= this.config.api.port;
	}

	// Runs before server starts listening
	server_start(kit){
		const f= 'ELBRedirect:server_start:';
		const {
            server
        } = kit.services.server;

		server.use((req, res, next)=> {
			//@log.debug f, {@host, 'request-headers-host': req.headers.host}
			// x-forwarded-proto indicates the request came from an Amazon Load Balancer
			// The first if mandates HTTPS and then redirects to the configured host
			let path;
			if ((req.method === 'GET') && (req.headers['x-forwarded-proto'] === 'http')) {
				path = 'https://' + this.host + req.href();
				this.log.debug(f, {method: req.method, header: req.headers['x-forwarded-proto'], path});
				res.setHeader('location', path);
				return res.send(302);
			// The second else if mandates that if a valid HTTPS request comes in with the wrong domain (e.g. www.app.influenceboard.com
			// then we redirect them to the configured host regardless of what the user typed in the browser
			} else if ((req.method === 'GET') && ((req.headers['x-forwarded-proto'] === 'https') && (req.headers.host !== this.host))) {
				path = 'https://' + this.host + req.href();
				this.log.debug(f, {method: req.method, header: req.headers['x-forwarded-proto'], path});
				res.setHeader('location', path);
				return res.send(302);
			// localhost needs to bypass all the above logic and work regardless of environment
			// ALB Health Checks rely on accessing the app over http and the is no req.headers['x-forwarded-proto'] passed through, so it works
			} else {
				return next();
			}
		});

		return server.get('/linkedinreturn', (req, res, next) => {
			const new_url= '/#!/linkedinreturn' + req.url.toString().substr(15);
			const protocol = this.host === 'localhost' ? 'http' : 'https';
			const path = protocol + '://' + req.header('host') + new_url;
			this.log.debug(f, {new_url, path});
			res.writeHead(301, {Location: path});
			return res.end();
		});
	}
}
ELBRedirect.initClass();

exports.ELBRedirect= ELBRedirect;
