class ELBRedirect {
	static initClass() {
		this.deps= {services:[ 'logger', 'server']};
	}
	constructor(kit){
		this.resource = "ELBRedirect"
		this.log= 	kit.services.logger.log;
		this.config = kit.services.config;
		this.host = this.config.api.host
		this.port = this.config.api.port
	}

	// Runs before server starts listening
	serverStart(kit){
		const { server } = kit.services.server;

		return server.use((req, res, next)=> {
			const f = `${this.resource}:server.use::`
			const href = req.href()
			const xForwarded = req.headers['x-forwarded-proto']
			const isNotSameHost = req.headers.host !== this.host
			const isHttp = xForwarded === 'http'
			const isGet = req.method === "GET"
			const path = `https://${host}${href}`
			const switchToHttps = isGet && isHttp
			const redirectToHost = isGet && !isHttp && isNotSameHost
			
			this.log.debug(f, { method: req.method, header: xForwarded, path })

			if(switchToHttps || redirectToHost) {
				res.setHeader('location', path)
				return res.send(302)
			}

			// localhost needs to bypass all the above logic and work regardless of environment
			// ALB Health Checks rely on accessing the app over http and the is no req.headers['x-forwarded-proto'] passed through, so it works
			next()

		});
	}
}
ELBRedirect.initClass();

exports.ELBRedirect= ELBRedirect;
