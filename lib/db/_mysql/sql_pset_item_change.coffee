#
#	Push Set Database Functions
#

Q= require 'q'
E= require '../../error'

class SqlPSetItemChange
	constructor: (@db, @log)->
		@table= 'pset_item_changes'
		@schema=
			create: ['pset_id','pset_item_id','verb','tbl','tbl_id','prev','after','resource']
			get_recent: ['id as count','pset_id','pset_item_id','tbl_id as id','verb','resource','prev','after']
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

	# Get the most recent pset item changes
	# limit: how many records you want to limit the response to
	# from: the id that you would like to start getting changes from
	get_recent: (ctx, limit, from)->
		f= "DB:SqlPSetItemChange:get_recent:"
		args= []
		sql_from= ''
		sql_limit= ''

		if typeof from is 'number'
			sql_from= ' AND id > ?'
			args.push from

		if typeof limit is 'number'
			sql_limit= 'LIMIT ?'
			args.push limit

		Q.resolve()
		.then ()=>

			sql= 'SELECT ' + (@schema.get_recent.join ',') + ' FROM ' + @table +
				' WHERE di= 0' + sql_from + ' ORDER BY id ' + sql_limit
			@db.sqlQuery ctx, sql, args
		.then (db_result)->
			db_result

exports.SqlPSetItemChange= SqlPSetItemChange