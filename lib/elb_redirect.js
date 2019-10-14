#
# Static Redirect Route Service
#


class ELBRedirect
	@deps= services:[ 'logger', 'server']
	constructor: (kit)->
		f= 'ELBRedirect:constructor'
		@log= 	kit.services.logger.log

	# Runs before server starts listening
	server_start: (kit)=>
		f= 'ELBRedirect:server_start:'
		server= kit.services.server.server

		server.use (req, res, next)=>
			if req.method is 'GET' and req.headers['x-forwarded-proto'] is 'http'
				path = 'https://' + req.header('host') + req.href()
				@log.debug f, {method: req.method, header: req.headers['x-forwarded-proto'], path: path}
				res.setHeader 'location', path
				res.send 302
			else
				next()

exports.ELBRedirect= ELBRedirect
