/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Mock Clases
//

// Mock Restify Requests
class RestifyRequest {
	constructor(opts){
		this.headers= 		(opts != null ? opts.headers : undefined) || {};
		this.url= 			(opts != null ? opts.url : undefined) || {};
		this.method= 		(opts != null ? opts.method : undefined) || {};
		this.statusCode= 	(opts != null ? opts.statusCode : undefined) || {};
		this.params= 		(opts != null ? opts.params : undefined) || {};
	}
}
exports.RestifyRequest= RestifyRequest;

// Mock Restify Responses
class RestifyResponse {
	constructor(opts){
		this.headers= (opts != null ? opts.headers : undefined) || {};
	}
	setHeader(nm, val){ return this.headers[nm]= val; }
	send(data){ return this.data= data; }
}
exports.RestifyResponse= RestifyResponse;