#
#	Refresh Token Database Functions
#
Promise= require 'bluebird'

class SqlToken
	@deps: {}
	constructor: (@core, kit)->
		@table= 'ident_tokens'
		@schema=
			Create: ['token', 'ident_id', 'client', 'exp']
			get: ['i.id', 'i.tenant', 'i.role']
			reread: ['*']
		@core.method_factory @, 'SqlToken'

	GetNonExpiredToken: (ctx, token)->
		# By joining with ident table, we won't keep giving out cached creds for e.g. tenant/role
		sql= """
			SELECT #{@schema.get.join ','} FROM #{@table} t
			JOIN ident i ON i.id= t.ident_id
			WHERE token = ? AND exp > CURDATE()
		"""
		(@core.sqlQuery ctx, sql, [token])
		.then (db_rows)-> db_rows

	UpdateActiveToken: (ctx, new_values, current_ident_token)=>
		Promise.resolve().bind @
		.then ->
			# Delete current refresh token if it exists
			return false unless current_ident_token
			sql= """
				DELETE FROM #{@table} 
				WHERE token = ?
				 """
			@core.sqlQuery ctx, sql, [current_ident_token]
		.then (db_result)->
			# Insert New Token
			@Create ctx, new_values, reread= true
		.then (db_rec)-> db_rec

exports.SqlToken= SqlToken
