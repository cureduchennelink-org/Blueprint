restify = require 'restify'
util = require 'util'

InvalidArg= (message, data)->
	restify.RestError.call this,
		statusCode: 400
		restCode: 'InvalidArgument'
		message: message
		body: {code: 'InvalidArgument', message, data}
		constructorOpt: InvalidArg
	this.name= 'Invalid Argument'

util.inherits InvalidArg, restify.RestError
exports.InvalidArg= InvalidArg