#
# User Routes
#
# Author: Jamie Hollowell
#
# 	kit dependencies:
#		db.[mysql,mongo]
#		wrapper
#		logger.log
#

Q= require 'q'
E= require '../lib/error'

odb= false # Mongo DB
sdb= false # MySql DB
_log= false

ident_tbl= 'ident'
extnd_tbl= 'profile'

class User
	constructor: (kit)->
		kit.logger.log.info 'Initializing User Routes...'
		odb= kit.db.mongo
		sdb= kit.db.mysql
		_log= kit.logger.log
		@caller=
			view_profile:
				use: true, wrap: 'read_wrap', version: any: @_view_profile
				sql_conn: true, auth_required: true
				pre_load: user: @_pl_user
			update_profile:
				use: true, wrap: 'update_wrap', version: any: @_update_profile
				sql_conn: true, auth_required: true
				pre_load: user: @_pl_user

	# Private Logic
	_view_profile: (conn, p, pre_loaded, _log)->
		use_doc= {}
		return use_doc if conn is 'use'

		f= 'User:_get:'

		Q.resolve()
		.then ->
			send:
				success: true
				users: [pre_loaded.user]


	_update_profile: (conn, p, pre_loaded, _log)->
		use_doc=
			fnm: 'S', lnm: 'S', website: 'S'
			avatar_path: 'S', avatar_thumb: 'S'
			prog_lang: 'S', skill_lvl: 'S'
		return use_doc if conn is 'use'

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
			sdb.user.update_by_ident_id conn, pre_loaded.user.id, new_user_values
		.then (db_result)->
			_log.debug f, 'got profile update result:', db_result
			throw new E.DbError 'User Update Failed' if db_result.affectedRows isnt 1
			new_user_values.id= pre_loaded.user.id

			send: success: true, updated_user: new_user_values


	# Preload the User. Stash inside pre_loaded.user
	# Expects conn, p.usid (/User/:usid)
	_pl_user: (conn, p)->
		f= 'User:_pl_user:'
		_log.debug f, p

		Q.resolve().then ->

			sdb.user.get_by_ident_id conn, p.usid
		.then (db_rows) ->
			throw new E.NotFoundError 'User' if db_rows.length isnt 1
			db_rows[0]

exports.User= User