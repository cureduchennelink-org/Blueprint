/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Registration Routes
//

const Q= require('q');
const E= require('../lib/error');

let sdb= false; // MySql DB
let _log= false;

class Registration {
	constructor(kit){
		this._signup = this._signup.bind(this);
		this._read_signup = this._read_signup.bind(this);
		this._register_signup = this._register_signup.bind(this);
		_log= 		kit.services.logger.log;
		sdb= 		kit.services.db.mysql;
		this.ses= 		kit.services.ses;
		this.auth= 		kit.services.auth;
		this.config= 	kit.services.config;
		this.tripMgr= 	kit.services.tripMgr;
		this.template= 	kit.services.template;

		// Registration endpoints
		this.endpoints= {
			signup: {
				verb: 'post', route: '/Signup',
				sql_conn: true, sql_tx: true, auth_required: false,
				use: true, wrap: 'default_wrap', version: { any: this._signup
			}
			},
			read_signup: {
				verb: 'get', route: '/Signup/:token',
				use: true, wrap: 'default_wrap', version: { any: this._read_signup
			},
				sql_conn: true, auth_required: false
			},
			register_signup: {
				verb: 'post', route: '/Signup/:token/register',
				use: true, wrap: 'default_wrap', version: { any: this._register_signup
			},
				sql_conn: true, sql_tx: true, auth_required: false
			}
		};
	}

	// Create Table for email template
	make_tbl(recipient, token, options){
		return {
			Trip: [ {token} ],
			Recipient: [ recipient ],
			Opt: [ options ]
		};
	}

	// Private Logic
	_signup(ctx, pre_loaded){
		const use_doc= {
			params: { fnm: 'r:S', lnm: 'r:S', eml: 'r:S'
		},
			response: { success: 'bool'
		}
		};
		if (ctx === 'use') { return use_doc; }
		_log= ctx.log;
		const { p }= ctx;
		let recipient= false;
		let success= false;

		const f= 'Registration:_signup:';

		// Validate a few Params
		if (!p.eml) { throw new E.MissingArg('eml'); }
		if (!p.fnm) { throw new E.MissingArg('fnm'); }
		if (!p.lnm) { throw new E.MissingArg('lnm'); }

		return Q.resolve()
		.then(() =>

			// Verify email doesn't already exist
			sdb.auth.GetByCredName(ctx, p.eml)).then(db_rows=> {
			_log.debug('got ident with eml:', db_rows);
			if (db_rows.length !== 0) { throw new E.AccessDenied('REGISTER:SIGNUP:EMAIL_EXISTS'); }

			// Create Trip and store email, fnm, lnm in json info. Never Expires (null).
			return this.tripMgr.planTrip(ctx, this.config.api.ident_id, { eml: p.eml, fnm: p.fnm, lnm: p.lnm }, null, 'signup');
		}).then(new_trip=> {
			_log.debug(f, 'got signup round trip:', new_trip);
			const trip= new_trip;

			// Send Signup email
			recipient= {email: p.eml, fnm: p.fnm, lnm: p.lnm};
			return this.ses.send('verify_signup', this.make_tbl(recipient, trip.token, this.config.ses.options));
		}).then(function(){
			success= true;

			// Send back to Client
			return {send: { success , recipient}};});
	}

	_read_signup(ctx, pre_loaded){
		const use_doc= {params: {}, response: {success: 'bool', signup: 'JSON'}};
		if (ctx === 'use') { return use_doc; }
		_log= ctx.log;
		const { p }= ctx;
		let trip= false;
		let success= false;

		const f= 'Registration:_read_signup:';

		return Q.resolve()
		.then(() => {

			// Retrieve trip info from Trip Manager
			return this.tripMgr.getTripFromToken(ctx, p.token);
	}).then(trip_info=> {
			_log.debug(f, 'got round trip:', trip_info);
			trip= trip_info;
			const bad_token= (trip_info.status === 'unknown') || (trip_info.status !== 'valid');
			if (bad_token) { throw new E.AccessDenied('REGISTER:READ_SIGNUP:BAD_TOKEN'); }
			trip.json= JSON.parse(trip.json);

			// Verify email doesn't already exist
			return sdb.auth.GetByCredName(ctx, trip.json.eml);
		}).then(db_rows=> {
			_log.debug('got ident with eml:', db_rows);
			if (db_rows.length !== 0) { throw new E.AccessDenied('REGISTER:READ_SIGNUP:EMAIL_EXISTS'); }
			success= true;

			// Return trip json info
			return {send: { success, signup: trip.json}};
		});
	}

	_register_signup(ctx, pre_loaded){
		const use_doc= {
			params: { fnm: 'r:S', lnm: 'r:S', eml: 'r:S', pwd: 'r:S'
		},
			response: { success: 'bool', eml_change: 'bool'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'Registration:_register_signup:';
		_log= ctx.log;
		const { p }= ctx;
		let trip= false;
		let change_trip= false;
		const { eml }= p;
		let eml_change= false;
		let new_ident_id= false;
		let new_pwd= '';
		let success= false;

		// Validate a few params
		if (!p.eml) { throw new E.MissingArg('eml'); }
		if (!p.pwd) { throw new E.MissingArg('pwd'); }
		if (!p.fnm) { throw new E.MissingArg('fnm'); }
		if (!p.lnm) { throw new E.MissingArg('lnm'); }


		return Q.resolve()
		.then(() => {

			// Retrieve trip info from Trip Manager
			return this.tripMgr.getTripFromToken(ctx, p.token);
	}).then(trip_info=> {
			_log.debug(f, 'got round trip:', trip_info);
			trip= trip_info;
			const bad_token= (trip_info.status === 'unknown') || (trip_info.status !== 'valid');
			if (bad_token) { throw new E.AccessDenied('REGISTER:REGISTER_SIGNUP:BAD_TOKEN'); }
			trip.json= JSON.parse(trip.json);
			eml_change= eml !== trip.json.eml;

			// Verify email doesn't already exist
			return sdb.auth.GetByCredName(ctx, eml);
		}).then(db_rows=> {
			_log.debug(f, 'got ident with eml:', db_rows);
			if (db_rows.length !== 0) { throw new E.AccessDenied('REGISTER:REGISTER_SIGNUP:EMAIL_EXISTS'); }
			success= true;

			// Encrypt the new password
			return this.auth.EncryptPassword(p.pwd);
		}).then(pwd_hash=> {
			new_pwd= pwd_hash;

			// Insert Ident Record
			const new_ident= {eml: trip.json.eml, pwd: new_pwd};
			return sdb.auth.Create(ctx, new_ident);
		}).then(db_result=> {
			if (db_result.affectedRows !== 1) { throw new E.DbError('REGISTER:REGISTER_SIGNUP:CREATE_IDENT'); }
			new_ident_id= db_result.insertId;

			// TODO: FRAMEWORK: HOW TO HOOK IN TO THE EXTENDED PROFILE TABLE?
			// Insert User/Profile Record
			const new_profile= {ident_id: new_ident_id, fnm: p.fnm, lnm: p.lnm};
			return sdb.user.Create(ctx, new_profile);
		}).then(db_result=> {
			if (db_result.affectedRows !== 1) { throw new E.DbError('REGISTER:REGISTER_SIGNUP:CREATE_PROFILE'); }

			// Return the Trip to the Trip Manager
			return this.tripMgr.returnFromTrip(ctx, trip.id, new_ident_id);
		}).then(()=> {

			// Send Signup Complete Email
			if (eml_change) { return false; }
			const recipient= {email: p.eml, fnm: p.fnm, lnm: p.lnm};
			return this.ses.send('signup_complete', this.make_tbl(recipient));
		}).then(()=> {

			// Create Trip and store email in json info
			if (!eml_change) { return false; }
			return this.tripMgr.planTrip(ctx, new_ident_id, { eml }, null, 'update_email');
		}).then(new_trip=> {
			_log.debug(f, 'got round trip:', new_trip);
			if (new_trip !== false) { change_trip= new_trip; }

			// Send 'Verify Email' email
			// TODO: Make a 'ReRegister' Endpoint so that we can send a 'Signup Complete' email on eml_change
			if (!eml_change) { return false; }
			const recipient= {email: eml};
			return this.ses.send('verify_email_change', this.make_tbl(recipient, change_trip.token));
		}).then(function(){
			success= true;

			// Return success
			return {send: { success , eml_change }};});
	}
}

exports.Registration= Registration;
