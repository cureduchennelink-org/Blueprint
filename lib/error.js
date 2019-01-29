/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const restify = require('restify');
const util = require('util');

var InvalidArg= function(message){
	restify.RestError.call(this, {
		statusCode: 400,
		body: {error: 'InvalidParam', message},
		constructorOpt: InvalidArg
	}
	);
	return this.name= 'Invalid Argument';
};

util.inherits(InvalidArg, restify.RestError);
exports.InvalidArg= InvalidArg;

var MissingArg= function(message){
	restify.RestError.call(this, {
		statusCode: 400,
		body: {error: 'MissingParam', message},
		constructorOpt: MissingArg
	}
	);
	return this.name= 'Missing Argument';
};

util.inherits(MissingArg, restify.RestError);
exports.MissingArg= MissingArg;

var NotFoundError= function(token, message){
	restify.RestError.call(this, {
		statusCode: 404,
		body: {error: token, message },
		constructorOpt: NotFoundError
	}
	);
	return this.name= 'Resource Not Found';
};

util.inherits(NotFoundError, restify.RestError);
exports.NotFoundError= NotFoundError;

var OAuthError= function(code, error, message){
	const body= message
	? {error, message} : {error};
	restify.RestError.call(this, {
		statusCode: code,
		restCode: 'OAuthError',
		message: 'Invalid OAuth Request',
		body,
		constructorOpt: OAuthError
	}
	);
	return this.name= 'OAuth 2.0 Error';
};

util.inherits(OAuthError, restify.RestError);
exports.OAuthError= OAuthError;

var BasicAuthError= function(error, message){
	const body= message
	? {error, message} : {error};
	restify.RestError.call(this, {
		statusCode: 401,
		restCode: 'BasicAuthError',
		message: 'Invalid Basic Auth Request',
		body,
		constructorOpt: BasicAuthError
	}
	);
	return this.name= 'OAuth 2.0 Error';
};

util.inherits(BasicAuthError, restify.RestError);
exports.BasicAuthError= BasicAuthError;

// token in the form 'MODULE:FUNCTION:CUSTOM_STRING'
var AccessDenied= function(token, message){
	restify.RestError.call(this, {
		statusCode: 403,
		body: {error: token, message},
		constructorOpt: AccessDenied
	}
	);
	return this.name= 'Access Denied';
};
util.inherits(AccessDenied, restify.RestError);
exports.AccessDenied= AccessDenied;

var DbError= function(token){
	restify.RestError.call(this, {
		statusCode: 500,
		restCode: 'DatabaseError',
		body: {error: token},
		constructorOpt: DbError
	}
	);
	return this.name= 'Database Error';
};

util.inherits(DbError, restify.RestError);
exports.DbError= DbError;

var ServerError= function(token, message){
	restify.RestError.call(this, {
		statusCode: 500,
		restCode: 'ServerError',
		body: {error: token, message},
		constructorOpt: ServerError
	}
	);
	return this.name= 'Server Error';
};

util.inherits(ServerError, restify.RestError);
exports.ServerError= ServerError;

var MongoDbError= function(message){
	restify.RestError.call(this, {
		statusCode: 500,
		restCode: 'MongoDbError',
		message,
		body: {error: 'mongo_error', message},
		constructorOpt: MongoDbError
	}
	);
	return this.name= 'Mongo Database Error';
};

util.inherits(MongoDbError, restify.RestError);
exports.MongoDbError= MongoDbError;