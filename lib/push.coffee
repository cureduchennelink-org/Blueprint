#
# Push Service Module
#

Q= require 'q'
E= require './error'

sdb= false
_log= false

class Push
	constructor: (@kit)->
		kit.services.logger.log.info 'Initializing Push Service...'
		sdb=	kit.services.db.mysql
		_log=	kit.services.logger.log
		@pset_by_name= {}

	GetPushSet: (ctx, clear_pset, nm)->
		f= 'Push:GetPushSet'
		_log= ctx.log
		_log.debug f, {clear_pset}, nm
		pset_id= false
		pset= @pset_by_name[nm] ? false
		return pset if pset and not clear_pset

		Q.resolve()
		.then ->

			# Acquire DB Connection
			sdb.core.Acquire()
		.then (c) ->
			ctx.conn= c if c isnt false

			# Start a Transaction
			sdb.core.StartTransaction(ctx)
		.then () ->

			# Grab the pset, or create one if it doesn't exist
			sdb.pset.read_or_insert ctx, nm
		.then (pset_rec)=>
			@pset_by_name[nm]= new PushSet pset_rec
			pset_id= pset_rec.id

			# if clear_pset is true remove all data related to pset id
			return false unless clear_pset
			@CleanPushSet ctx, pset_id
		.then (clean_result)->
			_log.debug f, 'got clean_result:', clean_result

			# Commit the transaction
			sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result) =>

			# Release DB Connection
			sdb.core.release ctx.conn

			return @pset_by_name[nm]
			# return new PushSet rec or existing @pset_by_name[nm]

	CleanPushSet: (ctx, pset_id)->
		f= 'Push:CleanPushSet'
		_log= ctx.log
		_log.debug f, {pset_id}
		item_ids= []

		Q.resolve()
		.then ()->
			
			# Grab all pset_item id's related to this pset
			sdb.pset_item.get_by_psid ctx, pset_id
		.then (db_rows)->
			_log.debug f, 'got item ids:', db_rows
			item_ids.push row.id for row in db_rows

			# Remove all pset_item_changes in pset_item ids
			sdb.pset_item_change.delete_items ctx, item_ids
		.then (db_result)->
			_log.debug f, 'got delete changes:', db_result

			# Remove all pset_items related to this pset
			sdb.pset_item.delete_pset ctx, pset_id
		.then (db_result)->
			_log.debug f, 'got delete items:', db_result

			true
			
class PushSet
	constructor: (@pset)-> # pset: id= 10, name= 'Todo'
		@c_items= {} # Cached Push Set Items. indexed by 'xref'

	# TODO: Implement xref
	# Must select pset_item for update to lock the row and guarantee
	#	pset_item_change id's are in order for that pset_item
	# p_item= Use @p_items[@pset.id, xref] or Select from pset_item table
	# If Item doesn't exist. Call @_createItem TODO: What if disabled?
	# Insert in pset_item_change table, args=[p_item.id, verb ... ]
	# TODO: Determine if we need to process insert ID
	itemChange: (ctx, xref, verb, prev, after, tbl_id, tbl)->
		f= "PushSet:#{@pset.name}:itemChange:"
		_log= ctx.log
		_log.debug f, { xref, verb, prev, after, tbl_id, tbl }
		pset_item_id= false

		Q.resolve()
		.then ()=>
			
			@getItem ctx, xref
		.then (item_handle)=>
			_log.debug f, { item_handle }
			pset_item_id= item_handle.id

			prev= JSON.stringify prev
			after= JSON.stringify after
			new_change= { pset_item_id, verb, prev, after, tbl_id, tbl }
			sdb.pset_item_change.create ctx, new_change
		.then ()=>

	# Return item handle to endpoint on behalf of client for websock call
	# TODO: Discuss who should start the transaction
	getItem: (ctx, xref)->
		f= "PushSet:#{@pset.name}:getItem:"
		_log= ctx.log
		_log.debug f, xref
		sxref= (String xref)
		handle= @c_items[sxref] ? false
		return handle if handle # Cached handle

		Q.resolve()
		.then ()=>

			# Look for existing pset handle in DB
			sdb.pset_item.get_psid_xref ctx, @pset.id, sxref
		.then (db_rows)=>
			_log.debug f, 'got pset_item:', db_rows
			if db_rows.length
				@c_items[sxref]= db_rows[0]
				return false

			# If handle doesn't exist. Call @_createItem
			@_createItem ctx, sxref
		.then (new_handle)=>
			_log.debug f, 'got new_handle:', new_handle
			if new_handle isnt false
				@c_items[sxref]= new_handle
		
			# Send back to client
			@c_items[sxref]		
	
	_createItem: (ctx, xref)->
		f= "PushSet:#{@pset.name}:_createItem:"
		_log= ctx.log
		_log.debug f, xref
		pset_id= @pset.id
		handle= false

		Q.resolve()
		.then ()->
			
			# Insert in to pset_item table (@pset.id, xref)
			sdb.pset_item.create ctx, { pset_id, xref }
		.then (db_result)=>
			_log.debug f, 'got create pset item result:', db_result
			id= db_result.insertId

			# Re-Read the PSetItem
			sdb.pset_item.get_by_id ctx, id
		.then (db_rows)=>
			_log.debug f, 'got re-read:', db_rows
			throw new E.DbError 'PUSHSET:CREATE_ITEM:REREAD' if db_rows.length isnt 1
			handle= db_rows[0]

			# Insert 'init' change record for the new pset_item
			@itemChange ctx, xref, 'init', {}, {}, null, null
		.then =>
			
			# return insertId
			handle

exports.Push= Push
