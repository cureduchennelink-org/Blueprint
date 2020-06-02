// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Authentication Route Logic
//

const Promise= require('bluebird');
const _= require('lodash');
const crypto= require('crypto');
const moment= require('moment');

class AuthRoute {
	static initClass() {
		this.deps= {services: ['error','config','logger','ses','auth','tripMgr','tokenMgr'], mysql: ['auth','token']};
		 // TODO 'event' is optional
	}
	constructor(kit){
		this._authenticate = this._authenticate.bind(this);
		this._update_email = this._update_email.bind(this);
		this._verify_email = this._verify_email.bind(this);
		this._update_password = this._update_password.bind(this);
		this._forgot_password = this._forgot_password.bind(this);
		this._verify_forgot = this._verify_forgot.bind(this);
		this._get_auth_trip = this._get_auth_trip.bind(this);
		this.E= 	kit.services.error;
		this.config= 	kit.services.config;
		this.log= 		kit.services.logger.log;
		this.ses= 		kit.services.ses;
		this.auth= 		kit.services.auth;
		this.tripMgr=	kit.services.tripMgr;
		this.tokenMgr= 	kit.services.tokenMgr;
		this.event=		kit.services.event != null ? kit.services.event : {emit() {}};
		this.sdb= 		kit.services.db.mysql;

		// Authentication  Endpoints
		this.endpoints= {
			authenticate: {
				verb: 'post', route: '/Auth',
				use: true, wrap: 'auth_wrap', version: { any: this._authenticate
			}
			},
			update_password: {
				verb: 'put', route: '/Auth/:auid/updatepassword',
				use: true, wrap: 'default_wrap', version: { any: this._update_password
			},
				sql_conn: true, sql_tx: true, auth_required: true
			},
			update_email: {
				verb: 'post', route: '/Auth/:auid/updateemail',
				use: true, wrap: 'default_wrap', version: { any: this._update_email
			},
				sql_conn: true, sql_tx: true, auth_required: true
			},
			forgot_password: {
				verb: 'post', route: '/AuthChange',
				use: true, wrap: 'default_wrap', version: { any: this._forgot_password
			},
				sql_conn: true, sql_tx: true
			},
			read_auth_trip: {
				verb: 'get', route: '/AuthChange/:token',
				use: true, wrap: 'default_wrap', version: { any: this._get_auth_trip
			},
				sql_conn: true
			},
			verify_forgot: {
				verb: 'post', route: '/AuthChange/:token/verifyforgot',
				use: true, wrap: 'default_wrap', version: { any: this._verify_forgot
			},
				sql_conn: true, sql_tx: true
			},
			verify_email: {
				verb: 'post', route: '/AuthChange/:token/verifyemail',
				use: true, wrap: 'default_wrap', version: { any: this._verify_email
			},
				sql_conn: true, sql_tx: true
			}
		};
	}

	make_tbl(recipient, token, options, page_name, ctx){
		const custom= ctx && (typeof this.config.ses.customize === 'function') ?
			this.config.ses.customize(ctx, page_name, recipient, token, options)
		: [{custom:false}];
		return {
			Trip: [ {token} ],
			Recipient: [ recipient ],
			Opt: [ options ],
			Custom: custom
		};
	}

	// POST /Auth
	_authenticate(ctx, pre_loaded){
		const use_doc= {
			params: { client_id: 'r:S', username: 'r:S', password: 'r:S', grant_type:'r:S'
		},
			response: {
				access_token: 'string',
				token_type: 'string',
				expires_in: 'number - seconds',
				refresh_token: 'string'
			}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_authenticate:';
		const {
            p
        } = ctx;
		const _log= ctx.log;
		_log.debug(f, p, pre_loaded);
		let current_token= false;
		const new_token= false;
		let need_refresh= true;
		const refresh_expires_in= this.config.auth.refreshTokenExpiration;
		const access_expires_in= this.config.auth.accessTokenExpiration;
		const result= {};

		return Promise.resolve().bind(this)
		.then(function() {

			// Validate Caller Credentials if requesting password
			if (p.grant_type !== 'password') { return false; }
			return this.auth.ValidateCredentials(ctx, p.username, p.password);}).then(function(ident_info){
			_log.debug(f, 'got ident_info:', ident_info);
			if (ident_info !== false) { result.auth= ident_info; }

			// Validate Refresh Token if requesting refresh_token
			if (p.grant_type !== 'refresh_token') { return false; }
			return this.sdb.token.GetNonExpiredToken(ctx, p.refresh_token);}).then(function(valid_token){
			_log.debug(f, 'got valid token:', valid_token);
			if (valid_token !== false) {
				if (valid_token.length === 0) { throw new this.E.OAuthError(401, 'invalid_grant', 'Refresh token invalid.'); }
				result.auth= valid_token[0];
			}

			// Validate Confidential Client if requesting client_credentials
			if (p.grant_type !== 'client_credentials') { return false; }
			if (!p.client_secret) { throw new this.E.MissingArg('client_secret'); }
			return this.auth.ValidateCredentials(ctx, p.client_id, p.client_secret);}).then(function(ident_info){
			_log.debug(f, 'got confidential ident_info:', ident_info);
			if (ident_info !== false) {
				result.auth= ident_info;
				need_refresh= false;
			}

			// Generate new refresh token
			if (!need_refresh) { return false; }
			return this.tokenMgr.CreateToken(16);}).then(function(token){

			// Store new token, remove old token
			if (!need_refresh) { return false; }
			if (p.grant_type === 'refresh_token') { current_token= p.refresh_token; }
			const exp= refresh_expires_in;
			const nv= {ident_id: result.auth.id, client: p.client_id, token, exp};
			return this.sdb.token.UpdateActiveToken(ctx, nv, current_token);}).then(function(ident_token){
			let refresh_token;
			if (ident_token !== false) {
				refresh_token= ident_token.token;
			}

			// Generate Access Token
			const exp= moment().add(access_expires_in, 'seconds');
			const i_info= {iid: result.auth.id};
			// These additional entries are added if exists
			if (result.auth.tenant != null) { i_info.itenant= result.auth.tenant; }
			if (result.auth.role != null) { i_info.irole= result.auth.role.split(","); }
			const access_token= this.tokenMgr.encode(i_info, exp, this.config.auth.key);

			// Publish event for other modules
			this.event.emit('r_auth.login', {ident_id: result.auth.id});

			// Return back to Client
			return {send: {access_token, token_type: 'bearer', expires_in: access_expires_in, refresh_token, info: i_info}};});
	}

	// POST /Auth/:auid/updateemail
	_update_email(ctx, pre_loaded){
		const use_doc= {
			params: { eml: 'r:S'
		},
			response: { success: 'bool'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_update_email:';
		const {
            p
        } = ctx;
		const {
            conn
        } = ctx;
		const _log= ctx.log;

		// Verify p.usid is the same as the auth_id. Validate params.
		if (p.auid !== 'me') {
			if ((Number(p.auid)) !== pre_loaded.auth_id) { throw new this.E.AccessDenied('AUTH:UPDATE_EMAIL:AUTH_ID'); }
		}
		if (!p.eml) { throw new this.E.MissingArg('eml'); }

		return Promise.resolve().bind(this)
		.then(function(){

			// Verify email doesn't already exist
			return this.sdb.auth.GetByCredName(ctx, p.eml);}).then(function(db_rows){
			_log.debug('got ident with eml:', db_rows);
			if (db_rows.length !== 0) { throw new this.E.AccessDenied('AUTH:UPDATE_EMAIL:EMAIL_EXISTS'); }

			// Create Trip and store email in json info
			return this.tripMgr.planTrip(ctx, pre_loaded.auth_id, { eml: p.eml }, null, 'update_email');}).then(function(new_trip){
			_log.debug(f, 'got round trip:', new_trip);
			const trip= new_trip;

			// Send 'Verify Email' email
			const recipient= {eml: p.eml};
			return this.ses.send('verify_email_change', this.make_tbl(recipient, trip.token, this.config.ses.options));}).then(function(){
			const success= true;

			// Send back to Client
			return {send: { success }};});
	}

	// POST /AuthTrip/:token/verifyemail
	_verify_email(ctx, pre_loaded){
		const use_doc= {params: {}, response: {success: 'bool'}};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_verify_email:';
		const {
            p
        } = ctx;
		const _log= ctx.log;
		let trip= false;
		let ident= false;
		let new_eml= false;

		return Promise.resolve().bind(this)
		.then(function(){

			// Retrieve trip info from Trip Manager
			return this.tripMgr.getTripFromToken(ctx, p.token);}).then(function(trip_info){
			_log.debug(f, 'got round trip:', trip_info);
			trip= trip_info;
			const bad_token= (trip_info.status === 'unknown') || (trip_info.status !== 'valid');
			if (bad_token) { throw new this.E.AccessDenied('AUTH:VERIFY_EMAIL:INVALID_TOKEN'); }
			if (trip.domain !== 'update_email') { throw new this.E.AccessDenied('AUTH:VERIFY_EMAIL:INVALID_DOMAIN'); }
			new_eml= (JSON.parse(trip.json)).eml;

			// Grab existing ident record
			return this.sdb.auth.GetById(ctx, trip.auth_ident_id);}).then(function(db_rows){
			_log.debug('got ident:', db_rows);
			if (db_rows.length !== 1) { throw new this.E.NotFoundError('AUTH:VERIFY_EMAIL:IDENT'); }
			ident= db_rows[0];

			// Verify email doesn't already exist
			return this.sdb.auth.GetByCredName(ctx, new_eml);}).then(function(db_rows){
			_log.debug('got ident with new_eml:', db_rows);
			if (db_rows.length !== 0) { throw new this.E.AccessDenied('AUTH:VERIFY_EMAIL:EMAIL_EXISTS'); }

			// Update the ident email
			return this.sdb.auth.update_by_id(ctx, ident.id, {eml: new_eml});}).then(function(db_result){
			_log.debug(f, 'got password update result:', db_result);
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('AUTH:VERIFY_EMAIL:AFFECTEDROWS'); }

			// Return the Trip to the Trip Manager
			return this.tripMgr.returnFromTrip(ctx, trip.id);}).then(function(){

			// Send 'Email Confirmed' email
			const recipient= {eml: new_eml};
			return this.ses.send('email_change_confirmed', this.make_tbl(recipient));}).then(function(){

			// Send back to Client
			const success= true;
			return {send: { success }};});
	}

	// POST/PUT /Auth/:auid/updatepassword
	_update_password(ctx, pre_loaded){
		const use_doc= {
			params: { pwd: 'r:S'
		},
			response: { success: 'bool'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_update_password:';
		const {
            p
        } = ctx;
		const {
            conn
        } = ctx;
		const _log= ctx.log;

		// Verify p.usid is the same as the auth_id. Validate params.
		if (p.auid !== 'me') {
			if ((Number(p.auid)) !== pre_loaded.auth_id) { throw new this.E.AccessDenied('AUTH:UPDATE_PASSWORD:AUTH_ID'); }
		}
		if (!p.pwd) { throw new this.E.MissingArg('pwd'); }

		return Promise.resolve().bind(this)
		.then(function(){

			// Encrypt the new password
			return this.auth.EncryptPassword(p.pwd);}).then(function(pwd_hash){

			// Update the ident password
			return this.sdb.auth.update_by_id(ctx, pre_loaded.auth_id, {pwd: pwd_hash});}).then(function(db_result){
			_log.debug(f, 'got password update result:', db_result);
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('AUTH:UPDATE_PASSWORD:AFFECTEDROWS'); }

			// Send back to Client
			const success= true;
			return {send: { success }};});
	}

	// POST /AuthChange
	_forgot_password(ctx, pre_loaded){
		const use_doc= {
			params: { eml: 'r:S'
		},
			response: { success: 'bool'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_forgot_password:';
		const {
            p
        } = ctx;
		const _log= ctx.log;
		let ident= false;

		// Validate params.
		if (!p.eml) { throw new this.E.MissingArg('eml'); }

		return Promise.resolve().bind(this)
		.then(function(){

			// Grab Ident Credentials
			return this.sdb.auth.GetByCredName(ctx, p.eml);}).then(function(db_rows){
			_log.debug('got ident:', db_rows);
			if (db_rows.length !== 1) { throw new this.E.NotFoundError('AUTH:FORGOT_PASSWORD:IDENT'); }
			ident= db_rows[0];

			// Plan a Round Trip
			return this.tripMgr.planTrip(ctx, ident.id, {}, null, 'forgot_password');}).then(function(new_trip){
			let trip;
			_log.debug(f, 'got round trip:', new_trip);
			if (new_trip !== false) { trip= new_trip; }

			// Send Forgot Email Password
			return this.ses.send('forgot_password', this.make_tbl(ident, trip.token, this.config.ses.options, 'forgot_password', ctx));}).then(function(){

			// Send back to Client
			const success= true;
			return {send: { success }};});
	}

	// POST /AuthTrip/:token/verifyforgot
	_verify_forgot(ctx, pre_loaded){
		const use_doc= {
			params: { pwd: 'r:S'
		},
			response: { success: 'bool'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_verify_forgot:';
		const {
            p
        } = ctx;
		const _log= ctx.log;
		let trip= false;
		let success= false;

		// Verify the params
		if (!p.pwd) { throw new this.E.MissingArg('pwd'); }

		return Promise.resolve().bind(this)
		.then(function(){

			// Retrieve trip info from Trip Manager
			return this.tripMgr.getTripFromToken(ctx, p.token);}).then(function(trip_info){
			_log.debug(f, 'got round trip:', trip_info);
			trip= trip_info;
			const bad_token= (trip_info.status === 'unknown') || (trip_info.status !== 'valid');
			if (bad_token) { throw new this.E.AccessDenied('AUTH:AUTH_TRIP:INVALID_TOKEN'); }
			if (trip.domain !== 'forgot_password') { throw new this.E.AccessDenied('AUTH:AUTH_TRIP:INVALID_DOMAIN'); }

			// Encrypt the new password
			return this.auth.EncryptPassword(p.pwd);}).then(function(pwd_hash){

			// Update the ident password
			return this.sdb.auth.update_by_id(ctx, trip.auth_ident_id, {pwd: pwd_hash});}).then(function(db_result){
			_log.debug(f, 'got password update result:', db_result);
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('AUTH:UPDATE_PASSWORD:AFFECTEDROWS'); }

			// Return the Trip to the Trip Manager
			return this.tripMgr.returnFromTrip(ctx, trip.id);}).then(function(){

			// Send back to Client
			success= true;
			return {send: { success }};});
	}

	// GET  /AuthTrip/:token
	_get_auth_trip(ctx, pre_loaded){
		const use_doc= {
			params: {},
			response: { ident: 'object'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Auth:_auth_trip:';
		const {
            p
        } = ctx;
		const _log= ctx.log;
		let bad_token= false;
		let trip= false;
		let ident= false;

		return Promise.resolve().bind(this)
		.then(function(){

			// Retrieve trip info from Trip Manager
			return this.tripMgr.getTripFromToken(ctx, p.token);}).then(function(trip_info){
			_log.debug(f, 'got round trip:', trip_info);
			trip= trip_info;
			bad_token= (trip_info.status === 'unknown') || (trip_info.status !== 'valid');
			if (bad_token) { throw new this.E.AccessDenied('AUTH:AUTH_TRIP:BAD_TOKEN'); }

			// Retrieve Ident Info
			return this.sdb.auth.GetById(ctx, trip.auth_ident_id);}).then(function(db_rows){
			_log.debug('got ident:', db_rows);
			if (db_rows.length !== 1) { throw new this.E.NotFoundError('AUTH:AUTH_TRIP:IDENT'); }
			ident= db_rows[0];
			ident.token= trip.token;

			// Send back to Client
			return {send: { ident }};});
	}

	// Preload the Auth Ident
	_pl_ident(ctx){
		const f= 'Auth:_pl_ident:';
		ctx.log.debug(f, ctx.p);

		return Promise.resolve().bind(this)
		.then(function() {

			// Retrieve Ident Info
			return this.sdb.auth.GetById(ctx, ctx.auth_id);}).then(function(db_rows){
			let ident;
			ctx.log.debug('got ident:', db_rows);
			if (db_rows.length !== 1) { throw new this.E.NotFoundError('AUTH:PRELOAD:IDENT'); }
			return ident= db_rows[0];});
	}
}
AuthRoute.initClass();

exports.AuthRoute= AuthRoute;
