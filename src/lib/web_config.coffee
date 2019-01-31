#
# Offer up dynamic config.js for web apps, based on config:web: document
#

class WebConfig
	@deps= services: ['config','logger'], config: 'web.config_document', server: true
	constructor: (kit)->
		f = 'WebConfig:constructor'
		@config = kit.services.config.web
		@log = kit.services.logger.log


	# Runs before server starts listening
	server_start: (kit)=>
		f = 'WebConfig:server_start:'
		server = kit.services.server.server

		path= /\/config.js$/
		@log.debug f, "Adding GET #{path}"
		server.get path, (req, res, next) =>
			res.header 'Content-Type', 'text/plain'
			res.send 200, @config.config_document
			return next

exports.WebConfig = WebConfig
