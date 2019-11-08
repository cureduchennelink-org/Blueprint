#
#	Refresh Token Database Functions
#

Q= require 'q'
E= require '../../error'

class SqlToken
	constructor: (@core, kit)->
		@log= kit.services.logger.log
		@table= 'ident_tokens'
		@schema=
			Create: ['token','ident_id','role','client','exp']
			get: ['*']
			reread: ['*']
		@core.method_factory @, 'SqlToken'

	GetNonExpiredToken: (ctx, token)->
		sql= 'SELECT '+ (@schema.get.join ',')+ ' FROM '+ @table+
			 ' WHERE token = ? AND exp > CURDATE()'
		(@core.sqlQuery ctx, sql, [token])
		.then (db_rows)-> db_rows

	UpdateActiveToken: (ctx, new_values, current_ident_token)=>
		Q.resolve().then ()=>
			# Delete current refresh token if it exists
			return false unless current_ident_token
			sql= 'DELETE FROM '+ @table+ ' WHERE token = ?'
			@core.sqlQuery ctx, sql, [current_ident_token]
		.then (db_result)=>
			# Insert New Token
			@Create ctx, new_values, reread= true
		.then (db_rec)=> db_rec

exports.SqlToken= SqlToken