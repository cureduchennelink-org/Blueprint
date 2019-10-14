#
# Push Service Module
#

Promise= require 'bluebird'
_= require 'lodash'

class Push
	@deps=
		mysql: ['pset','pset_item','pset_item_change'], services: ['error','util']
		config: 'push_service[poll_interval,max_buffer_size,poll_limit]'
	constructor: (kit)->
		f= 'BL/Push.constructor:'
		@config= 	kit.services.config.push_service
		@E=			kit.services.error
		@sdb=		kit.services.db.mysql
		@util= 		kit.services.util
		@interval=  @config.poll_interval # TODO: change to @poll_interval
		@interested_parties= [] # List of callbacks to call when changes are processed
		@pset_by_name= {}
		@count= 0
		@ctx= conn: null, log: kit.services.logger.log

	server_init: (kit)->
		f= 'Push:server_init'

		Promise.resolve().bind @
		.then ->

			# Acquire DB Connection
			@sdb.core.Acquire()
		.then (c)->
			@ctx.conn= c

	# Called after all services and routes have been initialized
	server_start: (kit)->
		f= 'Push:server_start'

		Promise.resolve().bind @
		.then ->

			# Read the latest item_change
			@sdb.pset_item_change.GetMostRecentChanges @ctx, 1
		.then (db_rows)->
			@ctx.log.debug f, 'got latest item_change', db_rows
			if db_rows.length
				@count= db_rows[0].count

			# Read as far back as we have room in the buffer for
			return [] unless db_rows.length
			@sdb.pset_item_change.GetMostRecentChanges @ctx, @config.max_buffer_size
		.then (db_rows)=>

			# Update all interested parties w/ most recent changes
			return false unless db_rows.length # No Changes
			cb db_rows for cb in @interested_parties
			null
		.then ()=>

			# Start the Poller
			@Start()

	RegisterForChanges: (cb)-> @interested_parties.push cb

	GetPushSet: (clear_pset, nm)->
		f= 'Push:GetPushSet:'
		@ctx.log.debug f, {clear_pset}, nm
		pset_id= false
		pset= @pset_by_name[nm] ? false
		return pset if pset and not clear_pset

		Promise.resolve().bind @
		.then ->

			# Grab the pset, or create one if it doesn't exist
			@sdb.pset.read_or_insert @ctx, nm
		.then (pset_rec)->
			@pset_by_name[nm]= new PushSet @E, @sdb, pset_rec, @util
			pset_id= pset_rec.id

			# if clear_pset is true remove all data related to pset id
			return false unless clear_pset
			@S_CleanPushSet @ctx, pset_id
		.then (clean_result)->
			@ctx.log.debug f, 'got clean_result:', clean_result

			# return new PushSet rec or existing @pset_by_name[nm]
			return @pset_by_name[nm]

	Start: ()-> @timer= setTimeout @S_Poll, @interval

	S_Poll: ()=>
		f= 'Push:Poll'
		limit= @config.poll_limit
		fromId= @count

		Promise.resolve().bind @
		.then ->

			# Read all pset_item_changes from last cursor
			@sdb.pset_item_change.GetNext @ctx, fromId, limit
		.then (db_rows)->
			if db_rows.length
				@count= db_rows[db_rows.length - 1].count

			return false unless db_rows.length # No Changes
			cb db_rows for cb in @interested_parties
			null
		.then ->

			# Restart the timer
			@timer= setTimeout @S_Poll, @interval

		.catch (e)->
			@ctx.log.error f, e, e.stack

	S_CleanPushSet: (ctx, pset_id)->
		f= 'Push:S_CleanPushSet'
		ctx.log.debug f, {pset_id}
		item_ids= []

		Promise.resolve().bind @
		.then ()->

			# Grab all pset_item id's related to this pset
			@sdb.pset_item.get_by_psid ctx, pset_id
		.then (db_rows)->
			ctx.log.debug f, 'got item ids:', db_rows
			item_ids.push row.id for row in db_rows

			# Remove all pset_item_changes in pset_item ids
			@sdb.pset_item_change.delete_items ctx, item_ids
		.then (db_result)->
			ctx.log.debug f, 'got delete changes:', db_result

			# Remove all pset_items related to this pset
			@sdb.pset_item.delete_pset ctx, pset_id
		.then (db_result)->
			ctx.log.debug f, 'got delete items:', db_result

			true

class PushSet
	constructor: (@E, @sdb, @pset, @util)-> # pset: id= 10, name= 'Todo'
		@c_items= {} # Cached Push Set Items. indexed by 'xref'

	ItemChange: (ctx, xref, verb, prev, now, resource, tbl_id, tbl)->
		f= "PushSet:#{@pset.name}:ItemChange:"
		ctx.log.debug f, { xref, verb, resource, tbl_id, tbl }
		pset_item_id= false

		# Optimization to skip if prev and now are the same during update
		[before, after]= @util.Diff prev, now
		ctx.log.debug f, { before, after}
		return false if (_.isEmpty after) and verb is 'update'

		Promise.resolve().bind @
		.then ->

			# Grab the pset_item's id
			@S_GetItem ctx, xref
		.then (item_rec)->
			ctx.log.debug f, { item_rec }
			pset_item_id= item_rec.id

			# Lock the pset_item
			@sdb.pset_item.lock ctx, pset_item_id
		.then (db_rows)->
			throw new @E.DbError 'PUSHSET:ITEMCHANGE:BAD_LOCK' unless db_rows.length is 1

			# Insert the change
			before= JSON.stringify before
			after= JSON.stringify after
			new_change= { pset_id: @pset.id, pset_item_id, verb, prev: before, after, resource, tbl_id, tbl }
			@sdb.pset_item_change.create ctx, new_change
		.then (db_result)->

			# Update pset_item count
			@sdb.pset_item.update_by_id ctx, pset_item_id, count: db_result.insertId
		.then (db_result)->
			throw new @E.DbError 'PUSHSET:ITEMCHANGE:UPDATE_COUNT' unless db_result.affectedRows is 1

			null

	GetPushHandle: (ctx, xref)->
		f= "PushSet:#{@pset.name}:GetPushHandle:"
		item= false
		item_change= false

		Promise.resolve().bind @
		.then ->

			@S_GetItem ctx, xref
		.then (item_rec)->
			item= item_rec

			@sdb.pset_item_change.GetMostRecentForItem ctx, @pset.id, item.id
		.then (db_rows)->
			throw new @E.ServerError "PUSHSET:GET_HANDLE:NO_LATEST_CHANGE", "#{@pset.id}/#{item.id}/?" unless db_rows.length
			item_change= db_rows[0]

			"#{@pset.id}/#{item.id}/#{item_change.id}"

	# Return item handle to endpoint on behalf of client for websock call
	# Assumption: The caller will start a transaction
	S_GetItem: (ctx, xref)->
		f= "PushSet:#{@pset.name}:S_GetItem:"
		ctx.log.debug f, xref

		sxref= (String xref)
		item= @c_items[sxref] ? false
		return item if item # Cached item

		Promise.resolve().bind @
		.then ->

			# Look for existing pset item in DB
			@sdb.pset_item.get_psid_xref ctx, @pset.id, sxref
		.then (db_rows)->
			ctx.log.debug f, 'got pset_item:', db_rows
			if db_rows.length
				@c_items[sxref]= db_rows[0]
				return false

			# If item doesn't exist. Call @S_CreateItem
			@S_CreateItem ctx, sxref
		.then (new_handle)->
			ctx.log.debug f, 'got new_handle:', new_handle
			if new_handle isnt false
				@c_items[sxref]= new_handle

			# Send back to client
			@c_items[sxref]

	S_CreateItem: (ctx, xref)->
		f= "PushSet:#{@pset.name}:S_CreateItem:"
		ctx.log.debug f, xref
		pset_id= @pset.id
		handle= false

		Promise.resolve().bind @
		.then ->

			# Insert in to pset_item table (@pset.id, xref)
			@sdb.pset_item.create ctx, { pset_id, xref }
		.then (db_result)->
			ctx.log.debug f, 'got create pset item result:', db_result
			id= db_result.insertId

			# Re-Read the PSetItem
			@sdb.pset_item.get_by_id ctx, id
		.then (db_rows)->
			ctx.log.debug f, 'got re-read:', db_rows
			throw new @E.DbError 'PUSHSET:CREATE_ITEM:REREAD' if db_rows.length isnt 1
			handle= db_rows[0]

			# Insert 'init' change record for the new pset_item
			prev= {}; after= {}; resource= null; tbl_id= null; tbl= null
			@ItemChange ctx, xref, 'init', prev, after, resource, tbl_id, tbl
		.then ->

			# return insertId
			handle

exports.Push= Push
