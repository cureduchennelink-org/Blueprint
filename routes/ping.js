/**
 * Route: /ping/:name
 * 
 * Route module for ping
 * 
 */

'use strict'
var _log = console.log;

function ping( req, res, next){
	var f = 'ping';
	_log(f, req.params);
	res.send(200, 'hello '+req.params.name);
	return next();
}
module.exports = ping;
