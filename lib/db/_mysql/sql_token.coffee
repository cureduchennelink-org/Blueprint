#
#	Refresh Token Database Functions
#

Q= require 'q'
E= require '../../error'

table= 'ident_tokens'

class SqlToken
	constructor: (db, log)->
		@log= log
		@db= db
		@schema=
			find: ['ident_id','client']
			insert: ['token','ident_id','client','exp','cr']

	find_token: (ctx, token)->
		sql= 'SELECT '+ (@schema.find.join ',') + ' FROM ' + table +
			 ' WHERE token = ? AND exp > CURDATE()'
		(@db.sqlQuery ctx, sql, [token])
		.then (db_rows)-> db_rows

	insert_token: (ctx, token, user_id, client_id, expires)->
		sql = 'INSERT INTO ' + table + ' ('+ (@schema.insert.join ',') + ') VALUES (?,?,?,?,NULL)'
		(@db.sqlQuery ctx, sql, [token, user_id, client_id, expires])
		.then (db_result)->	db_result

	delete_token: (ctx, token)->
		sql = 'DELETE FROM ' + table + ' WHERE token = ?'
		(@db.sqlQuery ctx, sql, [token])
		.then (db_result)-> db_result

	update_active_token: (ctx, user_id, clientId, expires, new_token, current_ident_token)=>

		Q.resolve()
		.then =>

			# Delete current refresh token if it exists
			return false unless current_ident_token
			@delete_token ctx, current_ident_token
		.then (db_result)=>

			# Insert New Token
			@insert_token ctx, new_token, user_id, clientId, expires
		.then (db_result)->
			throw new E.DbError 'Refresh Token Insert Failed' if db_result.affectedRows isnt 1
			new_token

exports.SqlToken= SqlToken