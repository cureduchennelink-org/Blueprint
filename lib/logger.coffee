#
# 	Logger Object
#
#	kit dependencies:
#		config.log

bunyan=  require 'bunyan'

class Logger
	constructor: (kit)->
		config= kit.services.config
		@log= bunyan.createLogger config.log
		@log.info 'Logger Initialized...'

exports.Logger= Logger