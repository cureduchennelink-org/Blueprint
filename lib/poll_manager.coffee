#
#	Poll Manager
#
_= require 'lodash'
{CircularBuffer}= require './circular_buffer'

_log= false
_log2= debug: ->

class PollManager
	@deps= services: ['logger', 'push'], config: 'push_service.max_buffer_size'
	constructor: (kit)->
		_log= 		kit.services.logger.log
		# DEBUG _log2= 		kit.services.logger.log
		@config= 	kit.services.config.push_service
		@push= 		kit.services.push
		@buffer= 	new CircularBuffer @C_ChangesAddedToBuffer, @C_ChangesRemovedFromBuffer, @config.max_buffer_size
		@pollers= {}
		@registry= {}
		@pollers_msgs= {}
		@data_set_idx= {}

	server_init: (kit)->
		f= 'PollManager:server_init:'
		@push.RegisterForChanges @C_PushChangesReceived

	PollerTimedOut: (id)-> @S_Finish id # Called when a req times out
	PollerClosed: (id)-> @S_CleanupPoller id # Called when a req connection is closed

	# Called by LongPollRoute to add a new long-poll request
	AddPoller: (id, req, res, listen, state, timeoutMillis)->
		f= 'PollManager:AddPoller:'
		@pollers[id]= {req, res, state, listen, handles: [], handle_map: {}}
		@pollers[id].timeout= setTimeout (=> @PollerTimedOut id), timeoutMillis

		# Add id to registry for each handle; Map given name to handle
		for nm, handle of listen
			[pset,item,count]= handle.split '/'
			partial_handle= pset+ '/'+ item
			@registry[partial_handle]?= []
			@registry[partial_handle].push id
			@pollers[id].handles.push partial_handle
			@pollers[id].handle_map[partial_handle]= nm
		_log2.debug f, 'handle_map:', @pollers[id].handle_map
		@S_ValidateHandles id, listen

	# TODO: Verify Access to Handles
	S_ValidateHandles: (id, listen)->
		f= 'PollManager:S_ValidateHandles:'
		missing_changes= []

		# Gather all changes this poller has missed
		for nm, handle of listen
			[pset,item,count]= handle.split '/'
			ph= pset+ '/'+ item # partial handle
			missing_changes.push change for change in @S_GetMissingChanges ph, count
		missing_changes.sort (a,b)-> a.count - b.count

		# Fast Forward the Poller if missing changes
		if missing_changes.length
			@S_FastForwardWithChanges id, @S_FormatChanges @S_SortChanges missing_changes

	# Add changes to index for easy access to circular buffer
	S_IndexChanges: (raw_changes, idx_list)->
		f= 'PollManager:S_IndexChanges:'
		for change, idx in raw_changes
			ph= change.pset_id+ '/'+ change.pset_item_id # partial handle
			@data_set_idx[ph]?= []
			@data_set_idx[ph].push idx_list[idx]

	# Remove changes from index that are no longer in the circular buffer
	S_UnIndexChanges: (raw_changes)->
		f= 'PollManager:S_UnIndexChanges:'
		for change in raw_changes
			ph= change.pset_id+ '/'+ change.pset_item_id # partial handle
			return unless @data_set_idx[ph]
			@data_set_idx[ph].shift()

	# TODO: Handle case where count is too far behind
	# Grab changes from the index/buffer that are newer than current_count
	S_GetMissingChanges: (partial_handle, current_count)->
		f= 'PollManager:S_GetMissingChanges:'
		changes= []
		idx_list= @data_set_idx[partial_handle]
		return [] unless idx_list?.length # TODO: WHAT HAPPENS IF HANDLE DOES NOT EXIST?
		newest_change= @buffer.getDataAtIndex idx_list[idx_list.length- 1]
		return [] if newest_change.verb is 'init' or newest_change.count is (Number current_count)
		for idx in idx_list
			change= @buffer.getDataAtIndex idx
			changes.push change if change.count > current_count
		changes

	# raw_changes
	#	[ {pset_id, pset_item_id, id, count, verb, prev, after, resource}]
	# Sort raw changes by their partial handles
	S_SortChanges: (raw_changes)->
		f= 'PollManager:S_SortChanges:'
		sorted_changes= {}

		# Sort the Changes by pset_id/pset_item_id
		for rec in raw_changes
			continue if rec.verb is 'init'
			partial_handle= "#{rec.pset_id}/#{rec.pset_item_id}"
			sorted_changes[partial_handle]?= []
			sorted_changes[partial_handle].push _.pick rec, ['id','count','verb','prev','after','resource']
		sorted_changes

	# sorted_changes:
	#	{ '1/6': [ {id,count,verb,prev,after,resource}, ...], '2/15': [], ...}
	# Modify sorted changes in to format Poller is expecting
	S_FormatChanges: (sorted_changes)->
		f= 'PollManager:S_FormatChanges:'
		data= {}
		formatted_changes= []

		for ph, change_list of sorted_changes # ph: partial_handle
			data[ph]= sync: {}, partial_handle: ph
			for change in change_list
				data[ph].count= change.count unless data[ph].count > change.count
				data[ph].sync[change.resource]?= []
				data[ph].sync[change.resource].push change
			formatted_changes.push data[ph]
		formatted_changes

	# formatted_changes:
	#	[ {partial_handle, count, sync }, ... ]
	# Respond to all Pollers that are waiting on changes
	S_RespondWithChanges: (formatted_changes)->
		f= 'PollManager:S_RespondWithChanges:'
		req_needs_response= []
		for change in formatted_changes
			_log2.debug f, "got count:#{change.count} handle: #{change.partial_handle}"
			h= change.partial_handle
			for id in @registry[h] ? []
				req_needs_response.push id unless id in req_needs_response
				nm= @pollers[id].handle_map[h]
				@pollers_msgs[id]?= {}
				@pollers_msgs[id][nm]= change.sync
				@pollers[id].listen[nm]= h+'/'+change.count
			@registry[h]= []
		@S_Finish id for id in req_needs_response

	# Respond to Poller that came in to the system behind
	S_FastForwardWithChanges: (id, formatted_changes)->
		f= 'PollManager:S_FastForwardWithChanges:'
		for change in formatted_changes
			_log2.debug f, "got count:#{change.count} handle: #{change.partial_handle}"
			h= change.partial_handle
			nm= @pollers[id].handle_map[h]
			@pollers_msgs[id]?= {}
			@pollers_msgs[id][nm]= change.sync
			@pollers[id].listen[nm]= h+'/'+change.count
		@S_Finish id

	# Completes a long-poll request for a single Poller
	S_Finish: (id)->
		f= 'PollManager:S_Finish:'
		_log2.debug f, id
		return unless id of @pollers # Request is gone
		{req,res,state,listen,timeout}= @pollers[id]
		clearTimeout timeout
		req.connection.resume()
		new_state= state
		if id of @pollers_msgs
			_log2.debug f, 'res end w/msgs', new_state, @pollers_msgs[id]
			res.send state: new_state, listen: listen, sync: @pollers_msgs[id]
		else
			_log2.debug f, 'res end w/o msgs', new_state
			res.send state: new_state, listen: listen, sync: {} # No msgs timeout (end 'long' poll)
		@S_CleanupPoller id

	# Cleanup all info related to a Poller id
	S_CleanupPoller: (id)->
		f= 'PollManager:S_CleanupPoller:'
		_log2.debug f, id
		return unless id of @pollers
		for handle in @pollers[id].handles when @registry[handle]
			_log2.debug f, "remove id:#{id} from registry:#{handle}", @registry[handle]
			ix= (@registry[handle].indexOf id)
			@registry[handle].splice ix, 1 if ix > -1
			delete @registry[handle] if @registry[handle].length is 0
		delete @pollers[id]
		delete @pollers_msgs[id]

	# Called when changes received from Push Polling System
	C_PushChangesReceived: (raw_changes)=>
		f= 'PollManager:C_PushChangesReceived:'
		_log.debug f, raw_changes.length
		for rec in raw_changes # Parse each change
			rec.after= JSON.parse rec.after
			rec.prev= JSON.parse rec.prev
		@buffer.push raw_changes, (err)->
			_log.error f, err, err.stack if err

	# Called when changes are added to the buffer
	C_ChangesAddedToBuffer: (raw_changes, idx_list, cb)=>
		f= 'PollManager:C_ChangesAddedToBuffer:'
		@S_IndexChanges raw_changes, idx_list
		@S_RespondWithChanges @S_FormatChanges @S_SortChanges raw_changes
		cb null

	# Called when changes are removed from the buffer
	C_ChangesRemovedFromBuffer: (raw_changes)=>
		f= 'PollManager:C_ChangesRemovedFromBuffer:'
		@S_UnIndexChanges raw_changes

exports.PollManager= PollManager

