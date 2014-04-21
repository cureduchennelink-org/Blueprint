#
#	User Database Functions
#

Q= require 'q'
E= require '../../error'

table= 'ident'
cred_col= 'eml'

class SqlAuth
	constructor: (db, log)->
		@db= db
		@log= log

	schema:
		auth:	['id','pwd']
		update_by_ident_id: ['eml','pwd']

	get_auth_credentials: (conn, cred_name)->
		f= 'DB.SqlAuth.get_auth_credentials:'
		@log.debug f, cred_name

		Q.resolve()
		.then =>

			# Grab the Ident Credentials
			sql= 'SELECT '+ (@schema.auth.join ',') +
				 ' FROM ' + table + ' WHERE ' + cred_col + '= ? and di= 0'
			@db.sqlQuery conn, sql, [cred_name]
		.then (db_rows)=>
			if db_rows.length isnt 1 or not db_rows[0].pwd
				throw new E.OAuthError 401, 'invalid_client' # TODO: Return a better error message here
			db_rows[0]

	update_by_id: (conn, ident_id, new_values)->
		f= 'DB.SqlAuth.update_by_id:'
		@log.debug f, ident_id, new_values

		for nm, val of new_values when nm not in @schema.update_by_ident_id
			throw new E.DbError 'Invalid Ident Update Column', col: nm, value: val

		Q.resolve()
		.then =>

			cols= []; arg=[]
			for nm, val of new_values
				cols.push nm + '= ?'; arg.push val
			arg.push ident_id
			sql= 'UPDATE ' + table + ' SET '+ (cols.join ',') +
				' WHERE id= ? AND di= 0'
			@db.sqlQuery conn, sql, arg
		.then (db_result)=>
			db_result

exports.SqlAuth= SqlAuth