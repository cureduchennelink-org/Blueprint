#
# User Routes
#

Q= require 'q'
E= require '../lib/error'

sdb= false # MySql DB
_log= false

class User
	constructor: (kit)->
		_log= 		kit.services.logger.log
		sdb= 		kit.services.db.mysql
		@template= 	kit.services.template
		@ses= 		kit.services.ses
		@tripMgr= 	kit.services.tripMgr

		# User Endpoint
		@endpoints=
			get:
				verb: 'get', route: '/User/:usid'
				use: true, wrap: 'default_wrap', version: any: @_view_profile
				sql_conn: true, auth_required: true
				pre_load: user: @_pl_user
			update_profile:
				verb: 'put', route: '/User/:usid/updateprofile'
				use: true, wrap: 'default_wrap', version: any: @_update_profile
				sql_conn: true, sql_tx: true, auth_required: true
				pre_load: user: @_pl_user

	# Private Logic
	_view_profile: (ctx, pre_loaded)=>
		use_doc=
			params: {}
			response: success: 'bool', users: 'list'
		return use_doc if ctx is 'use'
		success= false

		f= 'User:_get:'

		# Verify p.usid is the same as the auth_id
		throw new E.AccessDenied 'USER:VIEW_PROFILE:AUTH_ID' unless pre_loaded.auth_id is pre_loaded.user.id
		users= [pre_loaded.user]

		Q.resolve()
		.then ->
			success= true

			# Respond to Client
			send: { success, users }

	_update_profile: (ctx, pre_loaded)->
		use_doc=
			params:
				fnm: 'S', lnm: 'S', website: 'S'
				avatar_path: 'S', avatar_thumb: 'S'
				prog_lang: 'S', skill_lvl: 'S'
			response: success: 'bool', updated_user: 'object'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		# Verify p.usid is the same as the auth_id
		throw new E.AccessDenied 'USER:UPDATE_PROFILE:AUTH_ID' unless pre_loaded.auth_id is pre_loaded.user.id

		f= 'User:_update_profile:'
		updatable_fields= ['fnm','lnm','website','avatar_path','avatar_thumb','prog_lang','skill_lvl']
		new_user_values= {}
		new_user_values[nm]= val for nm,val of p when nm in updatable_fields

		Q.resolve()
		.then ->

			# Update the user's profile
			_log.debug f, new_user_values
			sdb.user.update_by_ident_id ctx, pre_loaded.user.id, new_user_values
		.then (db_result)->
			_log.debug f, 'got profile update result:', db_result
			throw new E.DbError 'User Update Failed' if db_result.affectedRows isnt 1
			new_user_values.id= pre_loaded.user.id

			send: success: true, updated_user: new_user_values


	# Preload the User. Stash inside pre_loaded.user
	# Expects ctx: conn, p.usid (/User/:usid)
	_pl_user: (ctx)->
		f= 'User:_pl_user:'
		ctx.log.debug f, ctx.p

		Q.resolve().then ->

			sdb.user.get_by_ident_id ctx, ctx.p.usid
		.then (db_rows) ->
			throw new E.NotFoundError 'User' if db_rows.length isnt 1
			db_rows[0]

exports.User= User