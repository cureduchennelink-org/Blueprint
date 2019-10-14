/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Custom rest errors
//
const errors = require('restify-errors');
const my_errors= {};
const f= 'lib/errors:';

let nm= 'ServerControlledException';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 420});
	return my_errors[ nm]= function(old_code, title, text, commands, goto){
		if (typeof goto !== 'string') { throw new Error(`lib/error::${nm}: Missing 'goto' in function arguments`); }
		if (typeof commands !== 'string') { commands= commands.join('~'); }
		const server_control= {title,text,commands,goto};
		const message= 'See server_control';
		const e= new ec({message});
		e.body= {code: 'ServerControl', message: 'See server_control', old_code, server_control};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'InvalidArg';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 400});
	return my_errors[ nm]= function(message){
		const e= new ec({message});
		e.body= { code: nm, message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'MissingArg';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 400});
	return my_errors[ nm]= function(message){
		const e= new ec({message});
		e.body= { code: nm, message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'NotFoundError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 404});
	return my_errors[ nm]= function(token, message){
		const e= new ec({message});
		e.body= { code: nm, message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'OAuthError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 401});
	return my_errors[ nm]= function(code, error, message){
		const e= new ec({message: 'Invalid OAuth Request'});
		e.body= message ? {code: error, message} : {code: error};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'BasicAuthError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 401});
	return my_errors[ nm]= function(error, message){
		let body;
		const e= new ec({message: 'Invalid Basic Auth Request'});
		e.body= (body= message ? {code: error, message} : {code: error});
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

// token in the form 'MODULE:FUNCTION:CUSTOM_STRING'
nm= 'AccessDenied';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 403});
	return my_errors[ nm]= function(token, message){
		const e= new ec({message});
		e.body= {code: token, message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'DbError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 500});
	return my_errors[ nm]= function(token){
		const e= new ec({message: token, restCode: 'DatabaseError'});
		e.body= {code: token};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'ServerError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 500});
	return my_errors[ nm]= function(token, message){
		const e= new ec({message});
		e.body= {code: token, message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'MongoDbError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 500});
	return my_errors[ nm]= function(message){
		const e= new ec({message});
		e.body= {code: 'mongo_error', message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

nm= 'TooManyConnectionsError';
(function(nm){
	const ec= errors.makeConstructor(nm, {statusCode: 426});
	return my_errors[ nm]= function(message){
		const e= new ec({message});
		e.body= {code: 'too_many_connections_error', message};
		console.log(f+ nm, e.body);
		return e;
	};
})(nm);

//console.log my_errors
for (nm in my_errors) { const val = my_errors[nm]; exports[nm]= val; }
