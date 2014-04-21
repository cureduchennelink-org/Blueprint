#
#	User Database Functions
#

Q= require 'q'
E= require '../../error'

table= 't1_users'

class SqlUser
	constructor: (db, log)->
		@db= db
		@log= log

	schema:
		create: ['first_name','last_name','email','password']
		update: ['first_name','last_name','email','password','disposal']

	get_all: (conn)->
		f= 'DB.SqlUser.get_all:'

		Q.resolve()
		.then =>

			sql= 'SELECT * FROM ' + table
			@db.sqlQuery conn, sql
		.then (db_rows)->
			db_rows

	create: (conn, new_values)->
		f= 'DB.SqlUser.create:'
		@log.debug f, new_values

		for nm, val of new_values when nm not in @schema.create
			throw new E.ServerError 'Invalid User Insert Column', col: nm, value: val

		Q.resolve()
		.then =>

			cols= []; qs= []; arg= []
			for nm, val of new_values
				cols.push nm; qs.push '?'; arg.push val
			sql= 'INSERT INTO ' + table + ' (' + (cols.join ',') + ') VALUES (' + (qs.join ',') + ')'
			@db.sqlQuery conn, sql, arg
		.then (db_result)=>
			@log.debug f, db_result
			throw new E.DbError 'User Insert Failed' if db_result.affectedRows isnt 1
			db_result

	update: (conn, id, new_values)->
		f= 'DB.SqlUser.update:'
		@log.debug f, id, new_values

		for nm, val of new_values when nm not in @schema.create
			throw new E.DbError 'Invalid User Update Column', col: nm, value: val

		Q.resolve()
		.then =>

			cols= []; arg=[]
			for nm, val of new_values
				cols.push nm + '= ?'; arg.push val
			arg.push id
			sql= 'UPDATE ' + table + ' SET '+ (cols.join ',') + ' WHERE id= ?'
			@db.sqlQuery conn, sql, arg
		.then (db_result)=>
			@log.debug f, db_result
			throw new E.DbError 'User Update Failed' if db_result.affectedRows isnt 1
			db_result

exports.SqlUser= SqlUser