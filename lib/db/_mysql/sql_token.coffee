#
#	Refresh Token Database Functions
#

Q= require 'q'
E= require '../../error'

table= 'ident_tokens'

class SqlToken
	constructor: (db, @tokenMgr, log)->
		@log= log
		@db= db

	schema:
		find: ['ident_id','client']
		insert: ['token','ident_id','client','exp','cr']

	find_token: (conn, token)->
		sql= 'SELECT '+ (@schema.find.join ',') + ' FROM ' + table +
			 ' WHERE token = ? AND exp > CURDATE()'
		(@db.sqlQuery conn, sql, [token])
		.then (db_rows)-> db_rows

	insert_token: (conn, token, user_id, client_id, expires)->
		sql = 'INSERT INTO ' + table + ' ('+ (@schema.insert.join ',') + ') VALUES (?,?,?,?,NULL)'
		(@db.sqlQuery conn, sql, [token, user_id, client_id, expires])
		.then (db_result)->	db_result

	delete_token: (conn, token)->
		sql = 'DELETE FROM ' + table + ' WHERE token = ?'
		(@db.sqlQuery conn, sql, [token])
		.then (db_result)-> db_result

	create_ident_token: (conn, user_id, clientId, expires, current_ident_token)=>
		new_token= false

		Q.resolve()
		.then =>

			# Generate new refresh token
			@tokenMgr.CreateToken 16
		.then (token)=>
			new_token= token

			# Delete current refresh token if it exists
			return false unless current_ident_token
			@delete_token conn, current_ident_token
		.then (db_result)=>

			# Insert New Token
			@insert_token conn, new_token, user_id, clientId, expires
		.then (db_result)->
			throw new E.DbError 'Refresh Token Insert Failed' if db_result.affectedRows isnt 1
			new_token

exports.SqlToken= SqlToken