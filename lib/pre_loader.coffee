#
#	Route Pre-Loader
#

Q= require 'q'

class PreLoader
	constructor: (db, log) ->
		log.info 'Initializing Pre-Loader...'
		@db= db
		@log= log

	load_user: (conn, usid)->
		@log.debug 'PreLoader.load_user:'
		Q.resolve().then =>

			sql= 'SELECT * FROM t1_users WHERE id= ? AND disposal= 0'
			@db.core.sqlQuery conn, sql, [usid]
		.then (db_rows) ->
			return false if db_rows.length is 0
			db_rows[0]
			
exports.PreLoader= PreLoader