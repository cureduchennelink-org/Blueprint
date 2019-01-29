/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Route Wrapper Module
//

const Q= require('q');
const E= require('./error');

let _log= false;
let odb= false;
let sdb= false;
let config= false;

class Wrapper {
	constructor(kit) {
		this.add_wrap = this.add_wrap.bind(this);
		this.add = this.add.bind(this);
		this.default = this.default.bind(this);
		_log= 		kit.services.logger.log;
		odb= 		kit.services.db.mongo;
		sdb= 		kit.services.db.mysql;
		({ config }=		kit.services);
		this.routes= 	kit.routes;
		this.router= 	kit.services.router;
		this.wraps= {};
	}

	add_wrap(mod, wrap){ // TOOD: See where this is used
		return this.wraps[mod]= wrap;
	}

	add(mod){
		const f= 'Wrapper:add:';
		if (mod in this.wraps) { return this.wraps[mod](mod); }
		return (() => {
			const result = [];
			for (let func in this.routes[mod].endpoints) {
				const endpoint = this.routes[mod].endpoints[func];
				endpoint.name= mod+':'+func;
				const wrap= this[endpoint.wrap](endpoint);
				result.push(this.router.AddRoute(mod, func, endpoint.verb, endpoint.route, wrap));
			}
			return result;
		})();
	}

	auth_wrap(caller){
		const auth_func= this.auth;
		return (q,s,n)=> auth_func(q, s, n, caller);
	}

	default_wrap(caller){
		const func= this.default;
		return (q,s,n)=> func(q, s, n, caller);
	}

	simple_wrap(caller){
		const func= this.simple;
		return (q,s,n)=> func(q, s, n, caller);
	}

	simple(req, res, next, caller) {
		const f= `Wrapper:simple:${caller.name}`;
		const route_logic= caller.version[req.params != null ? req.params.Version : undefined] != null ? caller.version[req.params != null ? req.params.Version : undefined] : caller.version.any;
		if (req === 'use') { return route_logic(req); }

		if (caller.auth_required) {
			if (!req.auth.authorize()) { return next(); }
		}

		// Call the Route Logic.
		return route_logic(req, res, next);
	}

	auth(req, res, next, caller){
		const f= "Wrapper:auth";
		if (!config.db.mysql.enable) { throw new E.ServerError('WRAPPER:AUTH:MYSQL_NOT_ENABLED'); }
		const route_logic= caller.version[req.params != null ? req.params.Version : undefined] != null ? caller.version[req.params != null ? req.params.Version : undefined] : caller.version.any;
		if (req === 'use') { return (caller.use !== true ? caller.use : route_logic(req)); }
		const ctx= {conn: null, p: req.params, log: req.log};
		const { p }= ctx;
		const pre_loaded= {};
		let send_result= false;
		const supported_grant_type= ['password','refresh_token','client_credentials'].includes(p.grant_type) ? true : false;

		return Q.resolve()
		.then(function() {

			// Validate client_id and grant_type
			if (!p.client_id) { throw new E.MissingArg('client_id'); }
			if (!supported_grant_type) { throw new E.OAuthError(400, 'unsupported_grant_type'); }

			// Acquire DB Connection
			return sdb.core.Acquire();}).then(function(c) {
			if (c !== false) { ctx.conn= c; }

			// Start a Transaction
			return sdb.core.StartTransaction(ctx);}).then(() =>

			// Call the Auth Logic. Pass in pre_loaded variables
			route_logic(ctx, pre_loaded)).then(function(result_hash) {
			send_result= result_hash.send;

			// Commit the transaction
			return sdb.core.sqlQuery(ctx, 'COMMIT');}).then(function(db_result) {

			// Release database conn; Respond to Client
			if (ctx.conn !== null) { sdb.core.release(ctx.conn); }
			res.send(send_result);
			return next();}).fail(function(err) {
			if (![ 400, 401, 403 ].includes(err.statusCode)) {
				req.log.error(f, '.fail', err, err.stack);
			} else {
				req.log.debug(f, '.fail', err, err.stack);
			}
			if (err.body && (err.body.error === 'invalid_client')) {
				res.setHeader('WWW-Authenticate', `Bearer realm=${config.auth.bearer}`);
			}
			if (ctx.conn !== null) {
				ctx.conn.query('ROLLBACK', function(err){
					if (err) {
						req.log.warn(f, 'destroy db conn (failed rollback)');
						sdb.core.destroy(ctx.conn);
						return req.log.error(f, '.fail', err.stack);
					} else {
						req.log.debug(f, 'release db conn (successful rollback)');
						return sdb.core.release(ctx.conn);
					}
				});
			}
			res.send(err);
			return next();
		});
	}

	default(req, res, next, endpoint) {
		const f= `Wrapper:default:${endpoint.name}`;
		const route_logic= endpoint.version[req.params != null ? req.params.Version : undefined] != null ? endpoint.version[req.params != null ? req.params.Version : undefined] : endpoint.version.any;
		if (req === 'use') { return (endpoint.use !== true ? endpoint.use : route_logic(req)); }
		const ctx= {
			conn: null, p: req.params,
			log: req.log, auth_id: (req.auth != null ? req.auth.authId : undefined),
			files: req.files, req, res
		};
		const { p }= ctx;
		const pre_loaded= {};
		let result= false;

		if (endpoint.auth_required || endpoint.permit) {
			if (!req.auth.authorize()) { return next(); }
			pre_loaded.auth_id= req.auth.authId;
		}

		return Q.resolve()
		.then(function() {

			// Acquire DB Connection
			if (!endpoint.sql_conn) { return false; }
			if (!config.db.mysql.enable) { throw new E.ServerError('WRAPPER:DEFAULT:MYSQL_NOT_ENABLED'); }
			return sdb.core.Acquire();}).then(function(c) {
			if (c !== false) { ctx.conn= c; }

			// Start a Transaction
			if (!endpoint.sql_tx) { return false; }
			if (!config.db.mysql.enable) { throw new E.ServerError('WRAPPER:DEFAULT:MYSQL_NOT_ENABLED'); }
			return sdb.core.StartTransaction(ctx);}).then(function() {

			// Loop through the endpoint's pre_load functions
			let q_result = Q.resolve(true);
			for (let nm in endpoint.pre_load) {
				const func = endpoint.pre_load[nm];
				((nm,func) =>
					q_result= q_result.then(() => func(ctx, pre_loaded)).then(function(pre_load_result) {
						_log.debug(f, `got ${nm}:`, pre_load_result);
						return pre_loaded[nm]= pre_load_result;
					})
				)(nm, func);
			}
			return q_result;}).then(() =>

			// Call the Route Logic. Pass in pre_loaded variables
			route_logic(ctx, pre_loaded)).then(function(result_hash) {
			result= result_hash;

			// Commit the transaction
			if (!endpoint.sql_conn) { return false; }
			return sdb.core.sqlQuery(ctx, 'COMMIT');}).then(function(db_result) {

			// Release database conn; Respond to Client
			if (ctx.conn !== null) { sdb.core.release(ctx.conn); }
			res.send(result.send);
			return next();}).fail(function(err) {
			if (![ 400, 403 ].includes(err.statusCode)) {
				req.log.error(f, '.fail', err, err.stack);
			} else {
				req.log.debug(f, '.fail', err);
			}
			if (ctx.conn !== null) {
				ctx.conn.query('ROLLBACK', function(err){
					if (err) {
						req.log.warn(f, 'destroy db conn (failed rollback)');
						sdb.core.destroy(ctx.conn);
						return req.log.error(f, '.fail', err.stack);
					} else {
						req.log.debug(f, 'release db conn (successful rollback)');
						return sdb.core.release(ctx.conn);
					}
				});
			}
			res.send(err);
			return next();
		});
	}
}

exports.Wrapper= Wrapper;