restify = require 'restify'
util = require 'util'

InvalidArg= (message, param)->
	restify.RestError.call this,
		statusCode: 400
		restCode: 'InvalidArgument'
		message: message
		body: {error: 'invalid_request', message, param}
		constructorOpt: InvalidArg
	this.name= 'Invalid Argument'

util.inherits InvalidArg, restify.RestError
exports.InvalidArg= InvalidArg

OAuthError= (code, error, message)->
	body= if message
	then {error: error, message} else {error: error}
	restify.RestError.call this,
		statusCode: code
		restCode: 'OAuthError'
		message: 'Invalid OAuth Request'
		body: body
		constructorOpt: OAuthError
	this.name= 'OAuth 2.0 Error'

util.inherits OAuthError, restify.RestError
exports.OAuthError= OAuthError

AccessDenied= (message)->
	restify.RestError.call this,
		statusCode: 403
		restCode: 'AccessDenied'
		message: message
		body: {error: 'access_denied', message}
		constructorOpt: AccessDenied
	this.name= 'Access Denied'

util.inherits AccessDenied, restify.RestError
exports.AccessDenied= AccessDenied

ServerError= (error, message)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'ServerError'
		message: message
		body: {error: error, message}
		constructorOpt: ServerError
	this.name= 'Server Error'

util.inherits ServerError, restify.RestError
exports.DbError= ServerError

DbError= (message)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'DatabaseError'
		message: message
		body: {error: 'database_error', message}
		constructorOpt: DbError
	this.name= 'Database Error'

util.inherits DbError, restify.RestError
exports.DbError= DbError

MongoDbError= (message)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'MongoDbError'
		message: message
		body: {error: 'mongo_error', message}
		constructorOpt: MongoDbError
	this.name= 'Mongo Database Error'

util.inherits MongoDbError, restify.RestError
exports.MongoDbError= MongoDbError