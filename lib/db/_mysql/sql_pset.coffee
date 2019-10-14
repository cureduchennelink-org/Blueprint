#
#	Push Set Database Functions
#
Promise= require 'bluebird'

class SqlPSet
	@deps= services: ['error','logger']
	constructor: (core, kit)->
		@log= kit.services.logger.log
		@E= kit.services.error
		@db= core
		@table= 'psets'
		@schema=
			create: ['name']
			get_by_id: ['*']
		@db.method_factory @, 'SqlPSet'

	get_by_name: (ctx, name)->
		f= "DB:SqlPushSet:get_by_name:"
		@log.debug f, name

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT * FROM #{@table} WHERE name= ? AND di= 0
				 """
			@db.sqlQuery ctx, sql, [name]
		.then (db_rows)->
			db_rows

	read_or_insert: (ctx, name)->
		f= "DB:SqlPushSet:read_or_insert:"
		_log= ctx.log
		_log.debug f, name
		existing_pset= false

		Promise.resolve().bind @
		.then ->

			# Look for existing PSet
			@get_by_name ctx, name
		.then (db_rows)->
			_log.debug f, 'got existing PSet:', db_rows
			if db_rows.length > 0
				existing_pset= db_rows[0]

			# Create new PSet if one doesn't exist
			return false if existing_pset
			@create ctx, name: name
		.then (db_result)->
			_log.debug f, 'got create PSet result:', db_result
			return false if db_result is false
			id= db_result.insertId

			# Re-Read the PSet to get the full record
			@get_by_id ctx, id
		.then (db_rows)->
			_log.debug f, 'got re-read:', db_rows
			if db_rows isnt false
				throw new @E.DbError 'DB:PUSHSET:REREAD' if db_rows.length isnt 1
				existing_pset= db_rows[0]

			existing_pset

exports.SqlPSet= SqlPSet

class SqlPSetItem
	constructor: (core, kit)->
		@log= kit.services.logger.log
		@db= core
		@table= 'pset_items'
		@schema=
			create: ['pset_id', 'xref']
			get_by_id: ['*']
			id_xref: ['*']
			get_psid: ['*']
			update_by_id: ['count']
		@db.method_factory @, 'SqlPSetItem'

	lock: (ctx, id)->
		f= "DB:SqlPSetItem:lock:"
		_log= ctx.log
		_log.debug f, id

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT id FROM #{@table}
				WHERE id= ? AND di= 0 FOR UPDATE
				 """
			@db.sqlQuery ctx, sql, [id]
		.then (db_rows)->
			db_rows

	get_psid_xref: (ctx, pset_id, xref)->
		f= "DB:SqlPSetItem:get_id_xref:"
		_log= ctx.log
		_log.debug f, pset_id, xref

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT #{@schema.id_xref.join ','} 
				FROM #{@table}
				WHERE pset_id= ? AND xref= ? AND di= 0
				 """
			@db.sqlQuery ctx, sql, [pset_id, xref]
		.then (db_rows)->
			db_rows

	get_by_psid: (ctx, pset_id)->
		f= "DB:SqlPSetItem:get_by_psid:"
		_log= ctx.log
		_log.debug f, pset_id

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT #{@schema.get_psid.join ','}
				FROM #{@table}
				WHERE pset_id= ? AND di= 0
				 """
			@db.sqlQuery ctx, sql, [pset_id]
		.then (db_rows)->
			db_rows

	delete_pset: (ctx, pset_id)->
		f= "DB:SqlPSetItem:delete_pset:"
		_log= ctx.log
		_log.debug f, pset_id

		Promise.resolve().bind @
		.then ->

			sql= """
				DELETE FROM #{@table}
				WHERE pset_id= ?
				 """
			@db.sqlQuery ctx, sql, [ pset_id ]
		.then (db_rows)->
			db_rows

exports.SqlPSetItem= SqlPSetItem

class SqlPSetItemChange
	constructor: (core, kit)->
		@log= kit.services.logger.log
		@db= core
		@table= 'pset_item_changes'
		@schema=
			recent: ['*']
			create: ['pset_id','pset_item_id','verb','tbl','tbl_id','prev','after','resource']
			next: ['id as count','pset_id','pset_item_id','tbl_id as id','verb','resource','prev','after']
		@db.method_factory @, 'SqlPSetItemChange'

	delete_items: (ctx, item_ids)->
		f= "DB:SqlPSetItemChange:delete_items:"
		_log= ctx.log
		_log.debug f, item_ids
		return affectedRows: 0 unless item_ids.length

		Promise.resolve().bind @
		.then ->

			sql= """
				DELETE FROM #{@table}
				WHERE pset_item_id IN (?)
				 """
			@db.sqlQuery ctx, sql, [ item_ids ]
		.then (db_result)->
			db_result

	# Grabs the last record inserted for a particular pset/item
	GetMostRecentForItem: (ctx, pset_id, pset_item_id)->
		f= "DB:SqlPSetItemChange:GetMostRecentForItem:"
		ctx.log.debug f

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT #{@schema.recent.join ','}
				FROM #{@table}
				WHERE di= 0 AND pset_id= ? AND pset_item_id= ?
				ORDER BY id DESC LIMIT 1
				 """
			@db.sqlQuery ctx, sql, [ pset_id, pset_item_id]
		.then (db_rows)->
			db_rows

	# Grabs the last N recent changes
	GetMostRecentChanges: (ctx, limit)->
		f= "DB:SqlPSetItemChange:GetMostRecentChanges:"
		ctx.log.debug f

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT #{@schema.next.join ','}
				FROM (SELECT * FROM #{@table}
					  WHERE di= 0
					  ORDER BY id DESC LIMIT ?) sub
				ORDER BY id ASC
				 """
			@db.sqlQuery ctx, sql, [ limit]
		.then (db_rows)->
			db_rows

	# Get the next set of pset item changes
	# from: the id that you would like to start getting changes from
	# limit: how many records you want to limit the response to
	GetNext: (ctx, from, limit)->
		f= "DB:SqlPSetItemChange:GetNext:"
		args= []
		sql_from= ''
		sql_limit= ''

		if typeof from is 'number'
			sql_from= ' AND id > ?'
			args.push from

		if typeof limit is 'number'
			sql_limit= 'LIMIT ?'
			args.push limit

		Promise.resolve().bind @
		.then ->

			sql= """
				SELECT #{@schema.next.join ','}
				FROM #{@table}
				WHERE di= 0 #{sql_from} 
				ORDER BY count #{sql_limit}
				 """
			@db.sqlQuery ctx, sql, args
		.then (db_rows)->
			db_rows

exports.SqlPSetItemChange= SqlPSetItemChange
