#
#	User Database Functions
#
#	A User is the join between the ident table and the profile table.
#

class SqlUser
	@deps: {}
	constructor: (core, kit)->
		@db= core
		@table= 'profile'
		@ident_tbl= 'ident'
		@schema=
			get_by_ident_id: [ # ident i LEFT OUTER JOIN profile e
				'i.id','i.eml',
				'e.fnm','e.lnm','e.cr','e.mo',
				'e.website','e.avatar_path','e.avatar_thumb','e.prog_lang','e.skill_lvl']
			update_by_ident_id: ['fnm','lnm','website','avatar_path','avatar_thumb','prog_lang','skill_lvl']
			Create: ['ident_id','fnm','lnm']

		@db.method_factory @, 'SqlUser'

	get_by_ident_id: (ctx, ident_id)->
		f= "SqlUser:get_by_ident_id:"

		sql= """
			SELECT #{@schema.get_by_ident_id.join ','}
			FROM #{@ident_tbl} i LEFT OUTER JOIN #{@table} e
				 ON i.id= e.ident_id 
			WHERE i.id= ? AND i.di= 0 AND (e.di= 0 OR e.id IS NULL)
			 """
		(@db.sqlQuery ctx, sql, [ident_id])
		.then (db_rows) ->
			db_rows
exports.SqlUser= SqlUser
