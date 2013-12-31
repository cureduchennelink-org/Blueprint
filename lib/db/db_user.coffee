#
#	User Database Functions
#

Q= require 'q'

class User
	constructor: (db, log)->
		@db= db
		@log= log
	
	create: (conn, first_name, last_name, email, password)->
		f= 'DB.User:'
		@log.debug f, first_name, last_name, email, password
		# TODO: Make a generic Insert by passing in an object of params
		# TODO: Define the param lists down at the bottom
		Q.resolve()
		.then =>
		
			sql= 'INSERT INTO t1_users (first_name, last_name, email, password, created) VALUES (?,?,?,?,NULL)'
			@db.sqlQuery conn, sql, [first_name, last_name, email, password]
		.then (db_result)->
			throw new Error 'DB_500_USERS_CREATE' if db_result.affectedRows isnt 1
			true

exports.User= User