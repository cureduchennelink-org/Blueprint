restify = require 'restify'
util = require 'util'

InvalidArg= (message)->
	restify.RestError.call this,
		statusCode: 400
		body: {error: 'InvalidParam', message}
		constructorOpt: InvalidArg
	this.name= 'Invalid Argument'

util.inherits InvalidArg, restify.RestError
exports.InvalidArg= InvalidArg

MissingArg= (message)->
	restify.RestError.call this,
		statusCode: 400
		body: {error: 'MissingParam', message}
		constructorOpt: MissingArg
	this.name= 'Missing Argument'

util.inherits MissingArg, restify.RestError
exports.MissingArg= MissingArg

NotFoundError= (token, message)->
	restify.RestError.call this,
		statusCode: 404
		body: {error: token, message }
		constructorOpt: NotFoundError
	this.name= 'Resource Not Found'

util.inherits NotFoundError, restify.RestError
exports.NotFoundError= NotFoundError

OAuthError= (code, error, message)->
	body= if message
	then {error, message} else {error}
	restify.RestError.call this,
		statusCode: code
		restCode: 'OAuthError'
		message: 'Invalid OAuth Request'
		body: body
		constructorOpt: OAuthError
	this.name= 'OAuth 2.0 Error'

util.inherits OAuthError, restify.RestError
exports.OAuthError= OAuthError

BasicAuthError= (error, message)->
	body= if message
	then {error, message} else {error}
	restify.RestError.call this,
		statusCode: 401
		restCode: 'BasicAuthError'
		message: 'Invalid Basic Auth Request'
		body: body
		constructorOpt: BasicAuthError
	this.name= 'OAuth 2.0 Error'

util.inherits BasicAuthError, restify.RestError
exports.BasicAuthError= BasicAuthError

# token in the form 'MODULE:FUNCTION:CUSTOM_STRING'
AccessDenied= (token, message)->
	restify.RestError.call this,
		statusCode: 403
		body: {error: token, message}
		constructorOpt: AccessDenied
	this.name= 'Access Denied'
util.inherits AccessDenied, restify.RestError
exports.AccessDenied= AccessDenied

DbError= (token)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'DatabaseError'
		body: {error: token}
		constructorOpt: DbError
	this.name= 'Database Error'

util.inherits DbError, restify.RestError
exports.DbError= DbError

ServerError= (token, message)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'ServerError'
		body: {error: token, message}
		constructorOpt: ServerError
	this.name= 'Server Error'

util.inherits ServerError, restify.RestError
exports.ServerError= ServerError

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