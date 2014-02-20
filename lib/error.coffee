restify = require 'restify'
util = require 'util'

success= false

InvalidArg= (message, data)->
	restify.RestError.call this,
		statusCode: 400
		restCode: 'InvalidArgument'
		message: message
		body: {code: 'InvalidArgument', success, message, data}
		constructorOpt: InvalidArg
	this.name= 'Invalid Argument'

util.inherits InvalidArg, restify.RestError
exports.InvalidArg= InvalidArg

AccessDenied= (message, data)->
	restify.RestError.call this,
		statusCode: 403
		restCode: 'AccessDenied'
		message: message
		body: {code: 'AccessDenied', success, message, data}
		constructorOpt: AccessDenied
	this.name= 'Access Denied'

util.inherits AccessDenied, restify.RestError
exports.AccessDenied= AccessDenied

DbError= (message, data)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'DatabaseError'
		message: message
		body: {code: 'DatabaseError', success, message, data}
		constructorOpt: DbError
	this.name= 'Database Error'

util.inherits DbError, restify.RestError
exports.DbError= DbError

MongoDbError= (message, data)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'DatabaseError'
		message: message
		body: {code: 'DatabaseError', success, message, data}
		constructorOpt: MongoDbError
	this.name= 'Mongo Database Error'

util.inherits MongoDbError, restify.RestError
exports.MongoDbError= MongoDbError