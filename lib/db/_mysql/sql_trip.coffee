#
#	Trip Database Functions
#

Q= require 'q'
E= require '../../error'


class SqlTrip
	constructor: (core, kit)->
		@log= kit.services.logger.log
		@db= core
		@table= 'trips'
		@schema=
			create: ['auth_ident_id','ident_id','token','domain','json','void','expires']
			update_by_id: ['json','void','expires','returned','ident_id']
			get_by_token: ['*']
			get_by_id: ['*']

		@db.method_factory @, 'SqlTrip'

	get_by_token: (ctx, token)->
		f= "DB:SqlTrip:get_by_token:"
		@log.debug f, token

		Q.resolve()
		.then =>

			sql= 'SELECT ' + (@schema.get_by_token.join ',') + ' FROM ' + @table +
				' WHERE token= ? AND di= 0'
			@db.sqlQuery ctx, sql, [token]
		.then (db_rows)->
			db_rows

exports.SqlTrip= SqlTrip