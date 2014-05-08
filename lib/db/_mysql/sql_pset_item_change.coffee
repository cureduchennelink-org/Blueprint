#
#	Push Set Database Functions
#

Q= require 'q'
E= require '../../error'

class SqlPSetItemChange
	constructor: (@db, @log)->
		@table= 'pset_item_change'
		@schema=
			create: ['pset_item_id','verb','tbl','tbl_id','prev','after']
		@db.method_factory @, 'SqlPSetItemChange'

	delete_items: (ctx, item_ids)->
		f= "DB:SqlPSetItemChange:delete_items:"
		_log= ctx.log
		_log.debug f, item_ids
		return affectedRows: 0 unless item_ids.length

		Q.resolve()
		.then =>

			sql= 'DELETE FROM ' + @table +
				' WHERE pset_item_id IN (?)'
			@db.sqlQuery ctx, sql, [ item_ids ]
		.then (db_result)->
			db_result

exports.SqlPSetItemChange= SqlPSetItemChange