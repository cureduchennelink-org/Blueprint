#
# 	Logger Object
#

bunyan=  require 'bunyan'

class Logger
	constructor: (kit)->
		config= kit.services.config
		@log= bunyan.createLogger config.log
		@log.info 'Logger Initialized...'

	server_use: (req, res, next) ->
		req.log.info  'ROUTE:', req.method, req.url
		(req.log.info 'PARAM:', nm + ':', val) for nm, val of req.params when nm not in ['_']
		return next()

exports.Logger= Logger