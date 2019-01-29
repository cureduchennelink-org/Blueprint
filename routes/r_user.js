/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// User Routes
//

const Q= require('q');
const E= require('../lib/error');

let sdb= false; // MySql DB
let _log= false;

class User {
	constructor(kit){
		this._view_profile = this._view_profile.bind(this);
		_log= 		kit.services.logger.log;
		sdb= 		kit.services.db.mysql;
		this.template= 	kit.services.template;
		this.ses= 		kit.services.ses;
		this.tripMgr= 	kit.services.tripMgr;

		// User Endpoint
		this.endpoints= {
			get: {
				verb: 'get', route: '/User/:usid',
				use: true, wrap: 'default_wrap', version: { any: this._view_profile
			},
				sql_conn: true, auth_required: true,
				pre_load: { user: this._pl_user
			}
			},
			update_profile: {
				verb: 'put', route: '/User/:usid/updateprofile',
				use: true, wrap: 'default_wrap', version: { any: this._update_profile
			},
				sql_conn: true, sql_tx: true, auth_required: true,
				pre_load: { user: this._pl_user
			}
			}
		};
	}

	// Private Logic
	_view_profile(ctx, pre_loaded){
		const use_doc= {
			params: {},
			response: { success: 'bool', users: 'list'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'User:_get:';
		let success= false;

		// Verify p.usid is the same as the auth_id
		if (pre_loaded.auth_id !== pre_loaded.user.id) { throw new E.AccessDenied('USER:VIEW_PROFILE:AUTH_ID'); }
		const user= [pre_loaded.user];

		// Respond to Client
		success= true;
		return {send: { success, user }};
	}

	_update_profile(ctx, pre_loaded){
		const use_doc= {
			params: {
				fnm: 'S', lnm: 'S', website: 'S',
				avatar_path: 'S', avatar_thumb: 'S',
				prog_lang: 'S', skill_lvl: 'S'
			},
			response: { success: 'bool', updated_user: 'object'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const { p }= 	  ctx;
		const { conn }= ctx;
		_log= ctx.log;

		// Verify p.usid is the same as the auth_id
		if (pre_loaded.auth_id !== pre_loaded.user.id) { throw new E.AccessDenied('USER:UPDATE_PROFILE:AUTH_ID'); }

		const f= 'User:_update_profile:';
		const updatable_fields= ['fnm','lnm','website','avatar_path','avatar_thumb','prog_lang','skill_lvl'];
		const new_user_values= {};
		for (let nm in p) { const val = p[nm]; if (Array.from(updatable_fields).includes(nm)) { new_user_values[nm]= val; } }

		return Q.resolve()
		.then(function() {

			// Update the user's profile
			_log.debug(f, new_user_values);
			return sdb.user.update_by_ident_id(ctx, pre_loaded.user.id, new_user_values);}).then(function(db_result){
			_log.debug(f, 'got profile update result:', db_result);
			if (db_result.affectedRows !== 1) { throw new E.DbError('User Update Failed'); }
			new_user_values.id= pre_loaded.user.id;

			return {send: {success: true, updated_user: new_user_values}};
		});
	}


	// Preload the User. Stash inside pre_loaded.user
	// Expects ctx: conn, p.usid (/User/:usid)
	_pl_user(ctx, pre_loaded){
		const f= 'User:_pl_user:';
		ctx.log.debug(f, ctx.p);
		const id= ctx.p.usid === 'me' ? pre_loaded.auth_id : ctx.p.usid;

		return Q.resolve().then(() => sdb.user.get_by_ident_id(ctx, id)).then(function(db_rows) {
			if (db_rows.length !== 1) { throw new E.NotFoundError('User'); }
			return db_rows[0];});
	}
}

exports.User= User;