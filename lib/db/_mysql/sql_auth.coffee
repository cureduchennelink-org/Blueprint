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
				throw new E.OAuthError 401, 'invalid_client'
			db_rows[0]

exports.SqlAuth= SqlAuth