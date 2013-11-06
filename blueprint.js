/**
 * Blueprint - Template Node Server
 * - Restify 2.6.0
 * - MySql 2.0.0-alpha9
 * 
 * Written for DV-Mobile by Jamie Hollowell
 * 
 */

var _log = console.log;
var restify = require('restify');
var config = (require('./lib/config'))();

// Create Database Objects
var Db = require('./lib/db').Db;
var db = new Db(config.db, _log);

// Include Library Service Modules

// Include Route Logic
var ping = require('./routes/ping');
var User = require('./routes/user');
var user = new User(db, _log);

// Create Server
var server = restify.createServer();

// Setup Handlers
server.use( function( req, res, next) {
	res.setHeader( 'Access-Control-Allow-Credentials', 'true');
	res.setHeader( 'Access-Control-Allow-Origin', req.headers.origin ||  '*');
	return next();
});

server.use( restify.queryParser() );
server.use( restify.bodyParser() );
server.use( function( req, res, next) {
	_log('ROUTE:', req.url, req.method);
	_log('PARAMS:', req.params);
	return next();
});

// Setup Routes

server.get('/ping/:name',			ping);

server.get('/User/:usid',			user.get);
server.post('/User/create',			user.createUser);


// Start the server
server.listen( config.api.port, function() {
	_log('Server listening at', server.url);
});