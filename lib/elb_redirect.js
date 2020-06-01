#
# Static Redirect Route Service
#

class ELBRedirect
	@deps= services:[ 'logger', 'server', 'config']
	constructor: (kit)->
		f= 'ELBRedirect:constructor'
		@log= 	kit.services.logger.log
		@config= kit.services.config
		@host= @config.api.host
		@port= @config.api.port

	# Runs before server starts listening
	server_start: (kit)=>
		f= 'ELBRedirect:server_start:'
		server= kit.services.server.server

		server.use (req, res, next)=>
			#@log.debug f, {@host, 'request-headers-host': req.headers.host}
			# x-forwarded-proto indicates the request came from an Amazon Load Balancer
			# The first if mandates HTTPS and then redirects to the configured host
			if req.method is 'GET' and (req.headers['x-forwarded-proto'] is 'http')
				path = 'https://' + @host + req.href()
				@log.debug f, {method: req.method, header: req.headers['x-forwarded-proto'], path: path}
				res.setHeader 'location', path
				res.send 302
			# The second else if mandates that if a valid HTTPS request comes in with the wrong domain (e.g. www.app.influenceboard.com
			# then we redirect them to the configured host regardless of what the user typed in the browser
			else if req.method is 'GET' and (req.headers['x-forwarded-proto'] is 'https' and req.headers.host isnt @host)
				path = 'https://' + @host + req.href()
				@log.debug f, {method: req.method, header: req.headers['x-forwarded-proto'], path: path}
				res.setHeader 'location', path
				res.send 302
			# localhost needs to bypass all the above logic and work regardless of environment
			# ALB Health Checks rely on accessing the app over http and the is no req.headers['x-forwarded-proto'] passed through, so it works
			else
				next()

		server.get '/linkedinreturn', (req, res, next) =>
			new_url= '/#!/linkedinreturn' + req.url.toString().substr(15)
			protocol = if @host is 'localhost' then 'http' else 'https'
			path = protocol + '://' + req.header('host') + new_url
			@log.debug f, {new_url, path}
			res.writeHead 301, Location: path
			res.end()

exports.ELBRedirect= ELBRedirect
