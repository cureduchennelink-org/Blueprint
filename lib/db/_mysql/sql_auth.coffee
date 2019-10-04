#
#	User Database Functions
#
Promise= require 'bluebird'

class SqlAuth
	@deps= {}
	constructor: (@core, kit)->
		@table= 'ident'
		@cred_col= 'eml'
		@pwd_col= 'pwd'
		@schema=
			auth: ['id', 'tenant', 'role', @pwd_col]
			cred: ['*']
			Create: [@cred_col,@pwd_col, 'role']
			UpdateById: [@cred_col,@pwd_col]
			GetByKey:
				id: ['id', @cred_col, 'tenant', 'role']
			reread: ['*']
		@core.method_factory @, 'SqlAuth'

	GetById: (ctx, id)=> @GetByKey ctx, 'id', [id]
	GetAuthCreds: (ctx, cred_name)->
		f= 'DB.SqlAuth.GetAuthCreds:'
		ctx.log.debug f, cred_name

		Promise.resolve().bind @
		.then ->

			# Grab the Ident Credentials
			sql= """
				SELECT #{@schema.auth.join ','}
				FROM #{@table}
				WHERE #{@cred_col}= ? and di= 0
				"""
			@core.sqlQuery ctx, sql, [cred_name]
		.then (db_rows)->
			db_rows

	GetByCredName: (ctx, cred_name)->
		f= 'DB.SqlAuth.GetByCredName:'
		ctx.log.debug f, cred_name

		Promise.resolve().bind @
		.then ->

			# Grab the Ident Credentials
			sql= """
				SELECT #{@schema.cred.join ','}
				FROM #{@table}
				WHERE #{@cred_col}= ? and di= 0
				"""
			@core.sqlQuery ctx, sql, [cred_name]
		.then (db_rows)->
			db_rows

exports.SqlAuth= SqlAuth
