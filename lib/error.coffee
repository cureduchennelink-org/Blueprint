restify = require 'restify'
util = require 'util'

ServerControlledException= (old_code, title, text, commands, goto)->
	throw new Error 'lib/error::ServerControlledException: Missing "goto" in function arguments' unless typeof goto is 'string'
	commands= commands.join '~' unless typeof commands is 'string'
	server_control= {title,text,commands,goto}
	restify.RestError.call this,
		statusCode: 420
		body: {error: 'ServerControl', message: 'See server_control', old_code, server_control}
		constructorOpt: ServerControlledException
	this.name= 'Server Controlled Exception'

util.inherits ServerControlledException, restify.RestError
exports.ServerControlledException= ServerControlledException
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

TooManyConnectionsError= (message)->
	restify.RestError.call this,
		statusCode: 426
		restCode: 'TooManyConnectionsError'
		message: message
		body: {error: 'too_many_connections_error', message}
		constructorOpt: TooManyConnectionsError
	this.name= 'Too Many ConnectionsError Error'

util.inherits TooManyConnectionsError, restify.RestError
exports.TooManyConnectionsError= TooManyConnectionsError
