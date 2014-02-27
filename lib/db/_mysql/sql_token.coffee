#
#	Refresh Token Database Functions
#

Q= require 'q'
E= require '../../error'

class SqlToken
	constructor: (db, @tokenMgr, log)->
		@log= log
		@db= db

	find_token: (conn, token)->
		sql = 'SELECT user_id, client_id FROM t1_refresh_tokens WHERE token = ? AND expires > CURDATE()'
		(@db.sqlQuery conn, sql, [token])
		.then (db_rows)-> db_rows

	insert_token: (conn, token, user_id, client_id, expires)->
		sql = 'INSERT INTO t1_refresh_tokens (token,user_id,client_id,expires,created) VALUES (?,?,?,?,NULL)'
		(@db.sqlQuery conn, sql, [token, user_id, client_id, expires])
		.then (db_result)->	db_result

	delete_token: (conn, token)->
		sql = 'DELETE FROM t1_refresh_tokens WHERE token = ?'
		(@db.sqlQuery conn, sql, [token])
		.then (db_result)-> db_result

	createRefreshToken: (conn, user_id, clientId, expires, currentRefreshToken)=>
		new_token= false

		Q.resolve()
		.then =>

			# Generate new refresh token
			@tokenMgr.CreateToken 16
		.then (token)=>
			new_token= token

			# Delete current refresh token if it exists
			return false unless currentRefreshToken
			@delete_token conn, currentRefreshToken
		.then (db_result)=>

			# Insert New Token
			@insert_token conn, new_token, user_id, clientId, expires
		.then (db_result)->
			throw new E.DbError 'Refresh Token Insert Failed' if db_result.affectedRows isnt 1
			new_token

exports.SqlToken= SqlToken