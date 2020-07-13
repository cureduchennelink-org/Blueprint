// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
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
const Promise= require('bluebird');

let request_count = 0;
let request_count_high= 0;

class Wrapper {
	static deps() {
		return {
			mysql: ['core'], mongo: ['pool'], services:[ 'router', 'lamd', 'error', 'auth', ], // auth for req.auth via server.use
			config: 'throttling.max_connections,db.mysql.enable,auth.bearer,perf?.test_user_override'
		};
	}
	constructor(kit) {
		this.add_wrap = this.add_wrap.bind(this);
		this.add = this.add.bind(this);
		this.auth = this.auth.bind(this);
		this.default = this.default.bind(this);
		this.config=	kit.services.config;
		this.E=			kit.services.error;
		this.odb= 		kit.services.db.mongo;
		this.sdb= 		kit.services.db.psql;
		this.router= 	kit.services.router;
		this.lamd= 	    kit.services.lamd;
		this.routes= 	kit.routes;
		this.wraps= {};
	}

	start_connection_limit() {
		if (this.config.throttling.max_connections && (request_count > this.config.throttling.max_connections)) {
			throw new this.E.TooManyConnectionsError("Max:" + this.config.throttling.max_connections + ", Count:" + request_count);
		}
		request_count++;
		if (request_count_high< request_count) { return request_count_high= request_count; }
	}

	end_connection_limit() {
		if (request_count) { return request_count--; }
	}

	add_wrap(mod, wrap){ // TODO: See where this is used
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
		return (q, s, n) => auth_func(q, s, n, caller);
	}

	default_wrap(caller){
		const func= this['default'];
		return (q, s, n) => func(q, s, n, caller);
	}

	simple_wrap(caller){
		const func= this.simple;
		return (q, s, n) => func(q, s, n, caller);
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
		const route_logic= caller.version[req.params != null ? req.params.Version : undefined] != null ? caller.version[req.params != null ? req.params.Version : undefined] : caller.version.any;
		if (req === 'use') { return (caller.use !== true ? caller.use : route_logic(req)); }
		const ctx= {conn: null, p: req.params, log: req.log};
		const {
            p
        } = ctx;
		const pre_loaded= {};
		let send_result= false;
		const supported_grant_type= ['password','refresh_token','client_credentials'].includes(p.grant_type) ? true : false;
		this.start_connection_limit();
		p.request_count= request_count;
		p.request_count_high= request_count_high;

		return Promise.resolve().bind(this)
		.then(function() {

			// Validate client_id and grant_type
			if (!p.client_id) { throw new this.E.MissingArg('client_id'); }
			if (!supported_grant_type) { throw new this.E.OAuthError(400, 'unsupported_grant_type'); }

			// Acquire DB Connection
			return this.sdb.core.Acquire();}).then(function(c) {
			if (c !== false) { ctx.conn= c; }

			// Start a Transaction
			return this.sdb.core.StartTransaction(ctx);}).then(() => // Call the Auth Logic. Pass in pre_loaded variables
        route_logic(ctx, pre_loaded)).then(function(result_hash) {
			send_result= result_hash.send;

			// Commit the transaction
			return this.sdb.core.sqlQuery(ctx, 'COMMIT');}).then(function(db_result) {

			// Release database conn; Respond to Client
			if (ctx.conn !== null) { this.sdb.core.release(ctx.conn); }
			res.send(send_result);
			this.end_connection_limit();
			return next();}).catch(function(err) {
			if (![ 400, 401, 403 ].includes(err.statusCode)) {
				req.log.error(f, '.catch', err, err.stack);
			} else {
				req.log.debug(f, '.catch', err, err.stack);
			}
			if (err.body && (err.body.error === 'invalid_client')) {
				res.setHeader('WWW-Authenticate', `Bearer realm=${this.config.auth.bearer}`);
			}
			if (ctx.conn !== null) {
				ctx.conn.query('ROLLBACK', err=> {
					if (err) {
						req.log.warn(f, 'destroy db conn (failed rollback)');
						this.sdb.core.destroy(ctx.conn);
						return req.log.error(f, '.catch', err.stack);
					} else {
						req.log.debug(f, 'release db conn (successful rollback)');
						return this.sdb.core.release(ctx.conn);
					}
				});
			}
			res.send(err.body ? err : new this.E.ServerError(err.name, err.message));
			this.end_connection_limit();
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
			files: req.files, req, res,
			spec: endpoint,
			lamd: {
				start: (new Date().getTime()), route: endpoint.route, verb: endpoint.verb,
				params: req.params, headers: req.headers, req_uuid: req._id, auth_id: 0
			}
		};
		const {
            p
        } = ctx;
		const pre_loaded= {};
		let result= false;

		// 'Authorize' calls res.send so don't put this logic inside promise chain where we try to 'send' on error
		if (endpoint.auth_required || endpoint.permit) {
			if (((this.config.perf != null ? this.config.perf.test_user_override : undefined) === true) && (typeof p.mock_id === "string")) {
				pre_loaded.auth_id= Number(p.mock_id);
			} else {
				// Authorize calls res.send so don't put this logic inside promise change where we try to 'send' on error
				if (!req.auth.authorize()) { return next(); }
				pre_loaded.auth_id= req.auth.authId;
			}
			ctx.lamd.auth_id= pre_loaded.auth_id;
		}

		return Promise.resolve().bind(this)
		.then(function() {
			this.start_connection_limit(); // Keep this below any logic that might return before end_* is called
			p.request_count= (ctx.lamd.request_count= request_count);
			return p.request_count_high= request_count_high;}).then(function() {

			// Acquire Mongo pool flavored Connection
			if (!endpoint.mongo_pool) { return false; }
			if (!(endpoint.mongo_pool in this.odb.pool)) { throw new this.E.ServerError('WRAPPER:DEFAULT:UNKNOWN_MONGO_POOL:'+ endpoint.mongo_pool); }
			return ctx.pool= this.odb.pool[ endpoint.mongo_pool];})
		.then(function() {

			// Acquire DB Connection
			if (!endpoint.sql_conn) { return false; }
			if (!this.config.db.mysql.enable) { throw new this.E.ServerError('WRAPPER:DEFAULT:MYSQL_NOT_ENABLED'); }
			return this.sdb.core.Acquire();}).then(function(c){
			if (c !== false) { ctx.conn= c; }

			// Start a Transaction
			if (!endpoint.sql_tx) { return false; }
			if (!this.config.db.mysql.enable) { throw new this.E.ServerError('WRAPPER:DEFAULT:MYSQL_NOT_ENABLED'); }
			return this.sdb.core.StartTransaction(ctx);}).then(function() {

			// Loop through the endpoint's pre_load functions
			let q_result = Promise.resolve().bind(this);
			for (let nm in endpoint.pre_load) {
				const func = endpoint.pre_load[nm];
				((nm,func) => {
					return q_result= q_result.then(() => func(ctx, pre_loaded)).then(function(pre_load_result){
						ctx.log.debug(f+ ':pre-load', `got ${nm}:`, pre_load_result);
						return pre_loaded[nm]= pre_load_result;
					});
				})(nm, func);
			}
			return q_result;}).then(() => // Call the Route Logic. Pass in pre_loaded variables
        route_logic(ctx, pre_loaded)).then(function(result_hash){
			result= result_hash;

			// Commit the transaction
			if (!endpoint.sql_conn) { return false; }
			return this.sdb.core.sqlQuery(ctx, 'COMMIT');}).then(function(db_result){

			// Release database conn; Respond to Client
			delete ctx.pool;
			if (ctx.conn !== null) { this.sdb.core.release(ctx.conn); }
			if (!endpoint.is_websock) { res.send(result.send); }
			ctx.lamd.statusCode= res.statusCode;
			const end = (new Date().getTime());
			ctx.lamd.duration = end - ctx.lamd.start;
			if (endpoint.lamd !== false) { this.lamd.write(ctx.lamd); }
			this.end_connection_limit();
			return next();}).catch(function(err){
			delete ctx.pool;
			if (![ 400, 403 ].includes(err.statusCode)) {
				req.log.error(f, '.catch', err, err.stack);
			} else {
				req.log.debug(f, '.catch', err);
			}
			if (ctx.conn !== null) {
				ctx.conn.query('ROLLBACK', err=> {
					if (err) {
						req.log.warn(f, 'destroy db conn (failed rollback)');
						this.sdb.core.destroy(ctx.conn);
						return req.log.error(f, '.catch', err.stack);
					} else {
						req.log.debug(f, 'release db conn (successful rollback)');
						return this.sdb.core.release(ctx.conn);
					}
				});
			}
			res.send(err.body ? err : new this.E.ServerError(err.name, err.message));
			ctx.lamd.statusCode= res.statusCode;
			const end = (new Date().getTime());
			ctx.lamd.duration = end - ctx.lamd.start;
			ctx.lamd.err= this._exposeErrorProperties(err);
			this.lamd.write(ctx.lamd);
			this.end_connection_limit();
			return next();
		});
	}

	// https://www.bennadel.com/blog/3278-using-json-stringify-replacer-function-to-recursively-serialize-and-sanitize-log-data.htm
	_exposeErrorProperties(error){
		const copy= Object.assign({}, error);
		// In the native Error class (and any class that extends Error), the
		// following properties are not "enumerable". As such, they won't be copied by
		// the Object.assign() call above. In order to make sure that they are included
		// in the serialization process, we have to copy them manually.
		if (error.name) { copy.name= error.name; }
		if (error.message) { copy.message= error.message; }
		//copy.stack= error.stack if error.stack
		return copy;
	}
}

exports.Wrapper= Wrapper;
