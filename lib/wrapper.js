/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Route Wrapper Module
//
// LAMD is not included in 'services' and must be manually added in your start-up. If it is not detected, standard bunyan is used
// TODO for LAMD:
//  - Sanitize function (I think SWMD has it)
//  - .start that is human readable
//
const Promise= require('bluebird');
const _= require('lodash');

let request_count = 0;
let request_count_high= 0;

class Wrapper {
	static initClass() {
		this.deps= {
			mysql: ['core'], mongo: ['pool'], services:[ 'router', 'error', 'auth', ], // auth for req.auth via server.use
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
		this.sdb= 		kit.services.db.mysql;
		this.router= 	kit.services.router;
		const stubb_lamd= {
			GetLog(ctx){ return ctx.log; },
			write(lamd){ return console.log(lamd); },
			write_deep(ctx){ return console.log('stubb_lamd::write_deep'); }
		};
		this.lamd= 	    kit.services.lamd != null ? kit.services.lamd : stubb_lamd; // You would need to add this service in your start-up script
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

	auth(req, res, next, endpoint){
		const f= "Wrapper:auth";
		if (!this.config.db.mysql.enable) { throw new this.E.ServerError('WRAPPER:AUTH:MYSQL_NOT_ENABLED'); }
		const route_logic= endpoint.version[req.params != null ? req.params.Version : undefined] != null ? endpoint.version[req.params != null ? req.params.Version : undefined] : endpoint.version.any;
		if (req === 'use') { return (endpoint.use !== true ? endpoint.use : route_logic(req)); }
		const ctx= {
			conn: null, p: req.params,
			log: req.log, auth_id: (req.auth != null ? req.auth.authId : undefined),
			files: req.files, req, res,
			spec: endpoint,
			lamd: {
				start: (new Date().getTime()), date: (new Date().toJSON()), // Timestamps
				route: endpoint.route, verb: endpoint.verb, req_uuid: req._id, auth_id: 0, // Filters
				params: (_.cloneDeep(req.params)) , headers: req.headers, // Inputs
				conn_id: 0
			} // Debugging
		};
		ctx.log= this.lamd.GetLog(ctx); // Potentially overwrite Bunyan with lamd.debug logging
		const {
            p
        } = ctx;
		const pre_loaded= {};
		let result= false;
		const supported_grant_type= ['password','refresh_token','client_credentials'].includes(p.grant_type) ? true : false;

		return Promise.resolve().bind(this)
		.then(function() {

			// Validate client_id and grant_type
			if (!p.client_id) { throw new this.E.MissingArg('client_id'); }
			if (!supported_grant_type) { throw new this.E.OAuthError(400, 'unsupported_grant_type'); }

			this.start_connection_limit(); // Keep this below any logic that might return before end_* is called
			ctx.lamd.request_count= request_count;
			ctx.lamd.request_count_high= request_count_high;

			// Acquire DB Connection
			return this.sdb.core.Acquire();}).then(function(c) {
			if (c !== false) { ctx.conn= c; }
			ctx.lamd.conn_id= c.__pool_id;
			if ((ctx.conn !== null) && (ctx.conn._protocol._fatalError !== null)) { throw new this.E.ServerError(f + 'BadHandle:' + JSON.stringify(this._exposeErrorProperties(ctx.conn._protocol._fatalError))); }

			// Start a Transaction
			return this.sdb.core.StartTransaction(ctx);}).then(() => // Call the Auth Logic. Pass in pre_loaded variables
        route_logic(ctx, pre_loaded)).then(function(result_hash) {
			if ((ctx.conn !== null) && (ctx.conn._protocol._fatalError !== null)) { throw new this.E.ServerError(f + 'BadHandle:' + JSON.stringify(this._exposeErrorProperties(ctx.conn._protocol._fatalError))); }
			result= result_hash;

			// Commit the transaction
			return this.sdb.core.sqlQuery(ctx, 'COMMIT');}).then(function(db_result) {

			// Release database conn; Respond to Client
			if (ctx.conn !== null) { this.sdb.core.release(ctx.conn); }
			if (result.send != null) {
				result.send.req_uuid= ctx.lamd.req_uuid;
			} // TODO ASSUMES RESULT.SEND IS AN OBJECT
			res.send(result.send); // Not for /Auth - unless endpoint.is_websock
			ctx.lamd.statusCode= res.statusCode;
			const end = (new Date().getTime());
			ctx.lamd.duration = end - ctx.lamd.start;
			if (endpoint.lamd !== false) { this.lamd.write(ctx.lamd); }
			if (endpoint.lamd !== false) { this.lamd.write_deep(ctx); } // TODO CHECK CONFIG IF WE WANT 200'S TO ALSO LOG THIS
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
			const e= err.body ? err : new this.E.ServerError(err.name, err.message);
			e.body.req_uuid= ctx.lamd.req_uuid;
			// TODO CONFIRM / TEST THAT IT WORKS BETTER TO PASS THIS TO next() INSTEAD OF: res.send e
			ctx.lamd.statusCode= err.statusCode != null ? err.statusCode : 5550;
			const end = (new Date().getTime());
			ctx.lamd.duration = end - ctx.lamd.start;
			ctx.lamd.err= this._exposeErrorProperties(err);
			this.lamd.write(ctx.lamd);
			this.lamd.write_deep(ctx); // TODO CHECK CONFIG IF WE WANT ALL STATUS CODES (LIKE 401) TO ALSO DO THIS
			this.end_connection_limit();
			e.toJSON= () => this._exposeErrorProperties(e.body);
			return next(e);
		}); // TODO TESTING
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
				start: (new Date().getTime()), date: (new Date().toJSON()), // Timestamps
				route: endpoint.route, verb: endpoint.verb, req_uuid: req._id, auth_id: 0, // Filters
				params: (_.cloneDeep(req.params)) , headers: req.headers, // Inputs
				conn_id: 0
			} // Debugging
		};
		ctx.log= this.lamd.GetLog(ctx); // Potentially overwrite Bunyan with lamd.debug logging
		const {
            p
        } = ctx;
		const pre_loaded= {};
		let result= false;

		// 'Authorize' calls res.send so don't put this logic inside promise chain where we try to 'send' on error
		if (endpoint.auth_required || endpoint.permit) {
			if (((this.config.perf != null ? this.config.perf.test_user_override : undefined) === true) && (p.mock_id != null)) {
				req.auth.authId= Number(p.mock_id);
				req.auth.role= p.mock_role != null ? p.mock_role : 'mock_role';
			} else {
				// Authorize calls res.send so don't put this logic inside promise change where we try to 'send' on error
				if (!req.auth.authorize()) { return next(); }
			}
				// Now req.auth.{authId,role} now set

			// TODO NEED TO STANDARIZE ON A LOCATION FOR THE POSSIBLE RICH SET OF AUTH VALUES (POSSIBLY NOT ALWAYS FROM A TOKEN, MAYBE DB?)
			// TODO LAMD LOGIC HERE MIGHT NEED BETTER STRATEGY WHEN TOKENS HAVE ARBITRARY KEYS ADDED VIA /AUTH
			pre_loaded.auth_id= (ctx.auth_id= (ctx.lamd.auth_id= req.auth.authId));
			pre_loaded.role   = (ctx.role=    (ctx.lamd.role   = req.auth.role));
		}

		return Promise.resolve().bind(this)
		.then(function() {
			// Validate permissions (using only the token) against 'endpoint' prior to consuming ANY resources (to avoid DoS)
			const accessDeniedError = message => { throw new this.E.AccessDenied(`${f} ${message}`); };
			if (endpoint.domain) { if (req.auth.token.domain !== endpoint.domain) { accessDeniedError('INVALID DOMAIN'); } }
			if (endpoint.roles) {
				const roles = req.auth.role;
				if (!roles || (roles.length === 0) || !Array.isArray(roles)) { accessDeniedError('MISSING ROLE'); }
				const role = (Array.from(roles).filter((aRole) => Array.from(endpoint.roles).includes(aRole)));
				if (role.length === 0) { accessDeniedError('INVALID ROLE'); }
			}

			this.start_connection_limit(); // Keep this below any logic that might return before end_* is called
			ctx.lamd.request_count= request_count;
			return ctx.lamd.request_count_high= request_count_high;}).then(function() {

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
			ctx.lamd.conn_id= c.__pool_id;
			if ((ctx.conn !== null) && (ctx.conn._protocol._fatalError !== null)) { throw new this.E.ServerError(f + 'BadHandle:' + JSON.stringify(this._exposeErrorProperties(ctx.conn._protocol._fatalError))); }
			// Start a Transaction
			if (endpoint.sql_tx !== true) { return false; }
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
			if ((ctx.conn !== null) && (ctx.conn._protocol._fatalError !== null)) { throw new this.E.ServerError(f + 'BadHandle:' + JSON.stringify(this._exposeErrorProperties(ctx.conn._protocol._fatalError))); }
			result= result_hash;

			// Commit the transaction
			if (endpoint.sql_tx !== true) { return false; }
			return this.sdb.core.sqlQuery(ctx, 'COMMIT');}).then(function(db_result){

			// Release database conn; Respond to Client
			delete ctx.pool;
			if (ctx.conn !== null) { this.sdb.core.release(ctx.conn); }
			if (result.send != null) {
				result.send.req_uuid= ctx.lamd.req_uuid;
			} // TODO ASSUMES RESULT.SEND IS AN OBJECT
			if (!endpoint.is_websock) { res.send(result.send); }
			ctx.lamd.statusCode= res.statusCode;
			const end = (new Date().getTime());
			ctx.lamd.duration = end - ctx.lamd.start;
			if (endpoint.lamd !== false) { this.lamd.write(ctx.lamd); }
			if (endpoint.lamd !== false) { this.lamd.write_deep(ctx); } // TODO CHECK CONFIG IF WE WANT 200'S TO ALSO LOG THIS
			this.end_connection_limit();
			return next();}).catch(function(err){
			delete ctx.pool;
			if (![ 400, 403 ].includes(err.statusCode)) {
				req.log.error(f, '.catch', err, err.stack);
			} else {
				req.log.debug(f, '.catch', err);
			}
			if (ctx.conn !== null) {
				if (endpoint.sql_tx !== true) {
					this.sdb.core.release(ctx.conn);
				} else {
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
			}
			const e= err.body ? err : new this.E.ServerError(err.name, err.message);
			e.body.req_uuid= ctx.lamd.req_uuid;
			// TODO CONFIRM / TEST THAT IT WORKS BETTER TO PASS THIS TO next() INSTEAD OF: res.send e
			ctx.lamd.statusCode= err.statusCode != null ? err.statusCode : 5550;
			const end = (new Date().getTime());
			ctx.lamd.duration = end - ctx.lamd.start;
			ctx.lamd.err= this._exposeErrorProperties(err);
			this.lamd.write(ctx.lamd);
			this.lamd.write_deep(ctx); // TODO CHECK CONFIG IF WE WANT ALL STATUS CODES (LIKE 401) TO ALSO DO THIS
			this.end_connection_limit();
			e.toJSON= () => this._exposeErrorProperties(e.body);
			return next(e);
		}); // TODO TESTING
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
Wrapper.initClass();

exports.Wrapper= Wrapper;
