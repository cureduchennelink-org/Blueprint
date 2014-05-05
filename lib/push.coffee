#
# Push Service Module
#

Q= require 'q'
E= require './error'

sdb= false

class Push
	constructor: (kit)->
		kit.services.logger.log.info 'Initializing Push Service...'
		sdb=	kit.services.db.mysql
		@log=	kit.services.logger.log
		@pset_by_name= {}

	GetPushSet: (ctx, clear_pset, nm, description)->
		f= 'Push:GetPushSet'
		_log= ctx.log
		_log.debug f, clear_pset, nm
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
		.then (existing_pset)->
			pset= existing_pset

			# if clear_pset is true remove all data related to pset id
			return false unless clear_pset
			sdb.pset.clean ctx, pset.id
		.then ->

			# Commit the transaction
			sdb.core.sqlQuery ctx, 'COMMIT'
		.then (db_result) ->

			# Release DB Connection
			sdb.core.release ctx.conn

			return nm
			# return new PushSet rec or existing @pset_by_name[nm]
class PushSet
	constructor: (@pset)->
		# pset: id= 10, description= 'todo_lists_by_ident_id', name= 'TodoMVC'
		@p_items= {}

	itemChange: (xref, verb, before, after, tbl_id, tbl)->
		# TODO: Implement xref
		# Must select pset_item for update to lock the row and guarantee
		#	pset_item_change id's are in order for that pset_item
		# p_item= Use @p_items[@pset.id, xref] or Select from pset_item table
		# If Item doesn't exist. Call @_createItem TODO: What if disabled?
		# Insert in pset_item_change table, args=[p_item.id, verb ... ]
		# TODO: Determine if we need to process insert ID

	# Return item handle to endpoint on behalf of client for websock call
	getItem: (xref)->
		# p_item= Use @p_items[@pset.id, xref] or Select from pset_item table
		# If Item doesn't exist. Call @_createItem TODO: What if disabled?
		#
		# Send back to client
		#
	_createItem: (xref)->
		# Insert in to pset_item table (@pset.id, xref)
		# return insertId
		# Insert 'init' change record for the new pset_item

exports.Push= Push
