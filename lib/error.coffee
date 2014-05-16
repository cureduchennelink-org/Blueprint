restify = require 'restify'
util = require 'util'

InvalidArg= (param)->
	restify.RestError.call this,
		statusCode: 400
		body: {error: 'INVALID', param}
		constructorOpt: InvalidArg
	this.name= 'Invalid Argument'

util.inherits InvalidArg, restify.RestError
exports.InvalidArg= InvalidArg

MissingArg= (param)->
	restify.RestError.call this,
		statusCode: 400
		body: {error: 'MISSING', param}
		constructorOpt: MissingArg
	this.name= 'Invalid Argument'

util.inherits MissingArg, restify.RestError
exports.MissingArg= MissingArg

NotFoundError= (token, param)->
	restify.RestError.call this,
		statusCode: 404
		body: {error: token, param }
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

# token in the form 'MODULE:FUNCTION:CUSTOM_STRING'
AccessDenied= (token)->
	restify.RestError.call this,
		statusCode: 403
		body: {error: token}
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

ServerError= (token)->
	restify.RestError.call this,
		statusCode: 500
		restCode: 'ServerError'
		body: {error: token}
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