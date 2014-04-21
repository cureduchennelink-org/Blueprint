#
#	User Database Functions
#
#	A User is the join between the ident table and the profile table.
#

Q= require 'q'
E= require '../../error'

ident_tbl= 'ident'
table= 'profile'

class SqlUser
	constructor: (db, log)->
		@db= db
		@log= log

	schema:
		# ident i LEFT OUTER JOIN profile e
		get_ident_id: ['i.id','i.eml',
				'e.fnm','e.lnm','e.cr','e.mo',
				'e.website','e.avatar_path','e.avatar_thumb','e.prog_lang','e.skill_lvl']
		update_by_ident_id: ['fnm','lnm','website','avatar_path','avatar_thumb','prog_lang','skill_lvl']
		create: ['first_name','last_name','email','password']

	get_all: (conn)->
		f= 'DB.SqlUser.get_all:'

		Q.resolve()
		.then =>

			sql= 'SELECT * FROM ' + table
			@db.sqlQuery conn, sql
		.then (db_rows)->
			db_rows

	create: (conn, new_values)->
		f= 'DB.SqlUser.create:'
		@log.debug f, new_values

		for nm, val of new_values when nm not in @schema.create
			throw new E.ServerError 'Invalid User Insert Column', col: nm, value: val

		Q.resolve()
		.then =>

			cols= []; qs= []; arg= []
			for nm, val of new_values
				cols.push nm; qs.push '?'; arg.push val
			sql= 'INSERT INTO ' + table + ' (' + (cols.join ',') + ') VALUES (' + (qs.join ',') + ')'
			@db.sqlQuery conn, sql, arg
		.then (db_result)=>
			@log.debug f, db_result
			throw new E.DbError 'User Insert Failed' if db_result.affectedRows isnt 1
			db_result

	update_by_ident_id: (conn, ident_id, new_values)->
		f= 'DB.SqlUser.update:'
		@log.debug f, ident_id, new_values

		for nm, val of new_values when nm not in @schema.update_by_ident_id
			throw new E.DbError 'Invalid User Update Column', col: nm, value: val

		Q.resolve()
		.then =>

			cols= []; arg=[]
			for nm, val of new_values
				cols.push nm + '= ?'; arg.push val
			arg.push ident_id
			sql= 'UPDATE ' + table + ' SET '+ (cols.join ',') +
				' WHERE ident_id= ? AND di= 0'
			@db.sqlQuery conn, sql, arg
		.then (db_result)=>
			db_result

	get_by_ident_id: (conn, ident_id)->
		f= 'DB.SqlUser.get_by_ident_id:'
		@log.debug f, ident_id

		Q.resolve()
		.then =>

			sql= 'SELECT '+ (@schema.get_ident_id.join ',') +
				' FROM ' + ident_tbl + ' i LEFT OUTER JOIN ' + table + ' e' +
				' ON i.id= e.ident_id WHERE i.id= ? AND i.di= 0 AND (e.di= 0 OR e.id IS NULL)'
			@db.sqlQuery conn, sql, [ident_id]
		.then (db_rows) ->
			db_rows

exports.SqlUser= SqlUser