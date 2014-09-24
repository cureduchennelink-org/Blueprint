#
#	Poll Manager
#

_= require 'lodash'
{CircularBuffer}= require './circular_buffer'

_log= false
_log2= debug: ()->

class PollManager
	constructor: (kit)->
		_log= 		kit.services.logger.log
		_log2= 		kit.services.logger.log
		@config= 	kit.services.config.push_service
		@push= 		kit.services.push
		@buffer= 	new CircularBuffer @C_ChangesAddedToBuffer, @C_ChangesRemovedFromBuffer, @config.max_buffer_size
		@pollers= {}
		@pollers_msgs= {}
		@registry= {}

	server_init: (kit)->
		f= 'PollManager:server_init:'
		@push.RegisterForChanges @C_PushChangesReceived
		@push.Start()

	# Called by LongPollRoute to add a new long-poll request
	AddPoller: (id, req, res, listen, state)->
		f= 'PollManager:AddPoller:'
		@pollers[id]= req: req, res: res, state: state, listen: listen, handles: [], handle_map: {}

		# Add id to registry for each handle; Map given name to handle
		for nm, handle of listen
			[pset,item,count]= handle.split '/'
			partial_handle= pset+ '/'+ item
			@registry[partial_handle]?= []
			@registry[partial_handle].push id
			@pollers[id].handles.push partial_handle
			@pollers[id].handle_map[partial_handle]= nm
		_log2.debug f, 'handle_map:', @pollers[id].handle_map


	PollerTimedOut: (id)-> @S_Finish id # Called when a req times out
	PollerClosed: (id)-> @S_CleanupPoller id # Called when a req connection is closed

	S_ProcessChanges: (raw_changes)->
		f= 'LongPoll:C_ProcessChanges:'
		@S_RespondWithChanges @S_FormatChanges @S_SortChanges raw_changes

	# raw_changes
	#	[ {pset_id, pset_item_id, id, count, verb, prev, after, resource}]
	S_SortChanges: (raw_changes)->
		f= 'Push:S_SortChanges:'
		sorted_changes= {}

		# Sort the Changes by pset_id/pset_item_id
		for rec in raw_changes
			continue if rec.verb is 'init'
			partial_handle= "#{rec.pset_id}/#{rec.pset_item_id}"
			sorted_changes[partial_handle]?= []

			# Parse / Filter each change
			rec.after= JSON.parse rec.after
			rec.prev= JSON.parse rec.prev
			sorted_changes[partial_handle].push _.pick rec, ['id','count','verb','prev','after','resource']
		sorted_changes

	# sorted_changes:
	#	{ '1/6': [ {id,count,verb,prev,after,resource}, ...], '2/15': [], ...}
	S_FormatChanges: (sorted_changes)->
		f= 'LongPoll:S_FormatChanges:'
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
	S_RespondWithChanges: (formatted_changes)->
		f= 'LongPoll:S_RespondWithChanges:'
		req_needs_response= []
		for change in formatted_changes
			_log2.debug f, "got count:#{change.count} handle: #{change.partial_handle}"
			_log2.debug f, "got sync:", change.sync
			h= change.partial_handle
			for id in @registry[h] ? []
				req_needs_response.push id unless id in req_needs_response
				nm= @pollers[id].handle_map[h]
				@pollers_msgs[id]?= {}
				@pollers_msgs[id][nm]= change.sync
				@pollers[id].listen[nm]= h+'/'+change.count
			@registry[h]= []
		@S_Finish id for id in req_needs_response

	# Respond to a long-poll request
	S_Finish: (id)->
		f= 'LongPoll:S_Finish:'
		_log2.debug f, id
		return unless id of @pollers # Request is gone
		{req,res,state,listen}= @pollers[id]
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
		f= 'LongPoll:S_CleanupPoller:'
		_log2.debug f, id
		return unless id of @pollers
		for handle in @pollers[id].handles
			_log2.debug f, "remove id:#{id} from registry:#{handle}", @registry[handle]
			ix= (@registry[handle].indexOf id) # TODO: BROWSERS: IE < 9 indexOf
			@registry[handle].splice ix, 1 if ix > -1
		delete @pollers[id]; delete @pollers_msgs[id]; # delete @pre_check_id[id]

	# Called when changes received from Push Polling System
	C_PushChangesReceived: (raw_changes)=>
		f= 'PollManager:C_PushChangesReceived:'
		_log.debug f, {raw_changes}
		@buffer.push raw_changes, (err)->
			_log.error f, err, err.stack if err

	# Called when changes are added to the buffer
	C_ChangesAddedToBuffer: (raw_changes, cb)=>
		f= 'PollManager:C_ChangesAddedToBuffer:'
		_log.debug f, {raw_changes}
		@S_ProcessChanges raw_changes
		cb null

	# Called when changes are removed from the buffer
	C_ChangesRemovedFromBuffer: (raw_changes)=>
		f= 'PollManager:C_ChangesRemovedFromBuffer:'
		_log.debug f, {raw_changes}

exports.PollManager= PollManager

