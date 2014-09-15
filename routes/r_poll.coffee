#
# Long Poll Routes
#

Q= require 'q'
E= require '../lib/error'
_= require 'lodash'

_log= false
_log2= debug: ()->

class LongPoll
	constructor: (kit)->
		_log= 		 kit.services.logger.log
		#_log2= 		 kit.services.logger.log
		@config= 	 kit.services.config
		@push= 		 kit.services.push
		@setTimeout= kit.services.test?.mock_setTimeout or setTimeout
		@long_timeout= @config.api.longPollTimeout
		_log.info 'Setting LongPoll Timeout to:', @long_timeout
		@safe_timeout= @long_timeout + 5000
		@pollers= {}
		@pollers_msgs= {}
		@pre_check_id= {}
		@registry= {}
		@endpoints=
			poll:
				verb: 'post', route: '/Poll'
				use: true, wrap: 'simple_wrap', version: any: @LongPollRequest
				auth_required: true
	server_init: (kit)-> @push.RegisterForChanges @C_ProcessChanges

	LongPollRequest: (req,res,next) =>
		use_doc= # TODO: API DOC: Review
			params: state:'obj', listen: 'obj'
			response: state: 'obj', listen: 'obj', sync: 'obj'
		return use_doc if req is 'use'
		f= 'LongPoll::_LongPollRequest:'
		_log= req.log
		p= req.params
		id= req.id()

		# Validate a few Params
		for arg in ['state','listen']
			(res.send new E.MissingArg arg; return next()) unless arg of p
		_log.debug f, 'state:',p.state,'listen:',p.listen

		# Plan for a long poll socket/request
		# Most browsers will kill the session after 30 mins.
		# We'll send something sooner, but need to locally enforce a close
		req.connection.pause()
		req.connection.setTimeout @safe_timeout # Allow unlimited http-keepalive requests
		req.on 'close', => # Clean up request, if unexpected close
			_log.debug 'REQ-EVENT:CLOSE', req.params, id
			@S_CleanupReq id

		# Add req to list of pollers
		state= p.state; listen= p.listen
		@pollers[id]= req: req, res: res, state: state, listen: listen, handles: [], handle_map: {}

		# Add id to registry for each handle; Map given name to handle
		for nm, handle of p.listen
			[pset,item,count]= handle.split '/'
			partial_handle= pset+ '/'+ item
			@registry[partial_handle]?= []
			@registry[partial_handle].push id
			@pollers[id].handles.push partial_handle
			@pollers[id].handle_map[partial_handle]= nm
		_log2.debug f, 'handle_map:', @pollers[id].handle_map

		# Timeout if no changes have occured
		@setTimeout (=> @C_Finish id), @long_timeout
		next()

	C_ProcessChanges: (sorted_changes)=>
		f= 'LongPoll:C_ProcessChanges:'
		req_needs_response= []
		for change in sorted_changes
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
		@C_Finish id for id in req_needs_response
	C_Finish: (id) =>
		f= 'LongPoll:C_Finish:'
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
		@S_CleanupReq id
	S_CleanupReq: (id)->
		f= 'LongPoll:S_CleanupReq:'
		_log2.debug f, id
		return unless id of @pollers
		for handle in @pollers[id].handles
			_log2.debug f, "remove id:#{id} from registry:#{handle}", @registry[handle]
			ix= (@registry[handle].indexOf id) # TODO: BROWSERS: IE < 9 indexOf
			@registry[handle].splice ix, 1 if ix > -1
		delete @pollers[id]; delete @pollers_msgs[id]; delete @pre_check_id[id]

exports.LongPoll= LongPoll

