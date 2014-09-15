#
#	User Database Functions
#

Q= require 'q'
E= require '../../error'

class SqlAuth
	constructor: (db, log)->
		@db= db
		@log= log
		@table= 'ident'
		@cred_col= 'eml'
		@pwd_col= 'pwd'
		@schema=
			auth:	['id', @pwd_col]
			update_by_id: [@cred_col,@pwd_col]
			get_by_cred: ['*']
			get_by_id: ['id',@cred_col]
			create: [@cred_col,@pwd_col]

		@db.method_factory @, 'SqlAuth'

	get_auth_credentials: (ctx, cred_name)->
		f= 'DB.SqlAuth.get_auth_credentials:'
		@log.debug f, cred_name

		Q.resolve()
		.then ()=>

			# Grab the Ident Credentials
			sql= 'SELECT '+ (@schema.auth.join ',') +
				 ' FROM '+ @table+ ' WHERE '+ @cred_col+ '= ? and di= 0'
			@db.sqlQuery ctx, sql, [cred_name]
		.then (db_rows)=>
			db_rows

	get_by_cred_name: (ctx, cred_name)->
		f= 'DB.SqlAuth.get_by_cred_name:'
		@log.debug f, cred_name

		Q.resolve()
		.then ()=>

			# Grab the Ident Credentials
			sql= 'SELECT '+ (@schema.get_by_cred.join ',') +
				 ' FROM '+ @table+ ' WHERE '+ @cred_col+ '= ? and di= 0'
			@db.sqlQuery ctx, sql, [cred_name]
		.then (db_rows)=>
			db_rows

exports.SqlAuth= SqlAuth