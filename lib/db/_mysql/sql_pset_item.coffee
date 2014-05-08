#
#	Push Set Database Functions
#

Q= require 'q'
E= require '../../error'

class SqlPSetItem
	constructor: (@db, @log)->
		@table= 'pset_item'
		@schema=
			create: ['pset_id', 'xref']
			get_by_id: ['*']
			id_xref: ['*']
			get_psid: ['*']
		@db.method_factory @, 'SqlPSetItem'

	get_psid_xref: (ctx, pset_id, xref)->
		f= "DB:SqlPSetItem:get_id_xref:"
		_log= ctx.log
		_log.debug f, pset_id, xref

		Q.resolve()
		.then =>

			sql= 'SELECT ' + (@schema.id_xref.join ',') + ' FROM ' + @table +
				' WHERE pset_id= ? AND xref= ? AND di= 0'
			@db.sqlQuery ctx, sql, [pset_id, xref]
		.then (db_rows)->
			db_rows

	get_by_psid: (ctx, pset_id)->
		f= "DB:SqlPSetItem:get_by_psid:"
		_log= ctx.log
		_log.debug f, pset_id

		Q.resolve()
		.then =>

			sql= 'SELECT ' + (@schema.get_psid.join ',') + ' FROM ' + @table +
				' WHERE pset_id= ? AND di= 0'
			@db.sqlQuery ctx, sql, [pset_id]
		.then (db_rows)->
			db_rows

	delete_pset: (ctx, pset_id)->
		f= "DB:SqlPSetItem:delete_pset:"
		_log= ctx.log
		_log.debug f, pset_id

		Q.resolve()
		.then =>

			sql= 'DELETE FROM ' + @table +
				' WHERE pset_id= ?'
			@db.sqlQuery ctx, sql, [ pset_id ]
		.then (db_rows)->
			db_rows

exports.SqlPSetItem= SqlPSetItem