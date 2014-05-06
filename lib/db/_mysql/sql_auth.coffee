#
#	User Database Functions
#

Q= require 'q'
E= require '../../error'

cred_col= 'eml'

class SqlAuth
	constructor: (db, log)->
		@db= db
		@log= log
		@table= 'ident'
		@schema=
			auth:	['id','pwd']
			update_by_id: ['eml','pwd']
			get_by_cred: ['*']
			get_by_id: ['id','eml']
			create: ['eml','pwd']

		@db.method_factory @, 'SqlAuth'

	get_auth_credentials: (ctx, cred_name)->
		f= 'DB.SqlAuth.get_auth_credentials:'
		@log.debug f, cred_name

		Q.resolve()
		.then =>

			# Grab the Ident Credentials
			sql= 'SELECT '+ (@schema.auth.join ',') +
				 ' FROM ' + @table + ' WHERE ' + cred_col + '= ? and di= 0'
			@db.sqlQuery ctx, sql, [cred_name]
		.then (db_rows)=>
			db_rows

	get_by_cred_name: (ctx, cred_name)->
		f= 'DB.SqlAuth.get_by_cred_name:'
		@log.debug f, cred_name

		Q.resolve()
		.then =>

			# Grab the Ident Credentials
			sql= 'SELECT '+ (@schema.get_by_cred.join ',') +
				 ' FROM ' + @table + ' WHERE ' + cred_col + '= ? and di= 0'
			@db.sqlQuery ctx, sql, [cred_name]
		.then (db_rows)=>
			db_rows

exports.SqlAuth= SqlAuth