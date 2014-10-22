class Cache
	constructor: ()->
		@c_dataset= {}
		@allowed=
			# StudyData:
			# 	endpoint: 'Patient/:pid:/Study', handler: @C_handleDelta,
			# 	data_nm: 'studyData', handle: 'study_:pid:'
			# 	params: ['pid']
			# 	sync: true
			Todo:
				endpoint: 'Prototype/Todo', handler: @C_handleDelta
				data_nm: 'Todo', handle: 'todo'
				sync: true, auth_req: false
		@rest= window.rest_v1
		@poller= new E.Extra.Poll @rest.GetPrefix(), @C_handlePoll
		@self_id= false

	LogoutEvent: ()->
		f= 'Cache:LogoutEvent:'
		_log2 f
		@poller.Stop()
		@c_dataset= {}
		@self_id= false
	S_MakeDataset: (resource,params)-> # Populates @c_dataset
		f= 'Cache:S_MakeDataset:'+resource
		dataset= @allowed[ resource].handle
		for nm in @allowed[ resource].params ? []
			BROKEN() if nm not of params
			dataset= dataset.replace ":#{nm}:", params[ nm]
		return dataset if dataset of @c_dataset # Already have one
		endpoint= @allowed[ resource].endpoint
		for nm in @allowed[ resource].params ? []
			endpoint= endpoint.replace ":#{nm}:", params[ nm]
		@c_dataset[ dataset]={ resource, endpoint, cb: []}
		_log2 f, params, @c_dataset[ dataset]
		dataset
	# cb is optional
	# returns cached resource or true if loading.
	GetResource: (resource, params, cb)-> # cb is optional
		f= 'Cache:GetResource:'
		_log2 f, resource
		rval= false
		BROKEN() if resource not of @allowed
		dataset= @S_MakeDataset resource, params
		if 'loading' not of @c_dataset[ dataset]
			data_or_true= @S_get dataset
			@c_dataset[ dataset].cb.push cb if cb
			rval= data_or_true # Loading if async, data if sync
		else if @c_dataset[ dataset].loading is true
			@c_dataset[ dataset].cb.push cb if cb
			rval= true # Loading
		else # Loaded
			rval= @c_dataset[ dataset].data
		rval

	S_get: (dataset)->
		f= 'Cache:S_get:'+dataset
		_log2 f
		@c_dataset[ dataset].loading= true # S_get's been called
		resource= @c_dataset[ dataset].resource
		endpoint= @c_dataset[ dataset].endpoint
		tactic= if @allowed[resource].auth_req is false then 'NoAuthGet' else 'Get'
		if @allowed[resource].sync is true
			data= @rest[tactic] endpoint, f, {}
			@C_handleRest dataset, data
			return data
		else
			setTimeout ()=>
				data= @rest[tactic] endpoint, f, {}
				@C_handleRest dataset, data
			, 1000
			return true
	# Handles the response from a REST resource request
	C_handleRest: (dataset, data)=>
		f= 'Cache:C_handleRest:'+dataset
		_log2 f, data
		BROKEN_CACHED() if dataset not of @c_dataset # TODO: BROKEN: Implement
		resource= @c_dataset[ dataset].resource
		@c_dataset[ dataset].loading= false
		@c_dataset[ dataset].data= data
		@self_id= data.user[0].id if resource is 'Self' and data.success is true
		main_r= data[ @allowed[ resource].data_nm]
		for sub_r of main_r # Create indexed version of sub resource
			if $.isArray main_r[sub_r]
				main_r[sub_r+'_idx']= {}
				main_r[sub_r+'_idx'][row.id]= row for row in main_r[sub_r]
			else
				main_r[sub_r+'_idx']= {}
				main_r[sub_r+'_idx'][main_r[sub_r].id]= main_r[sub_r]
		if @allowed[ resource].sync isnt true
			for cb in @c_dataset[ dataset].cb
				cb resource, data # TODO RESOURCE IS ABIGUOUS IF NOT SAME AS DATASET; ADD PARAMS?
		@poller.Listen dataset, data.push_handle if 'push_handle' of data # Only if it's a pset
	# Handles the response from a Long Poll request
	C_handlePoll: (response)=>
		f= 'Cache:C_handlePoll:'
		_log2 f, response
		for handle, data of response.sync
			dataset= handle
			resource= @c_dataset[ dataset].resource
			@allowed[resource].handler dataset, data
		return true
	# TODO: Gracefully handle id's we haven't seen before
	C_handleDelta: (dataset, new_data)=>
		f= 'Cache:C_handleDelta:'
		resource= @c_dataset[ dataset].resource
		data= @c_dataset[ dataset].data
		main_r= data[ @allowed[ resource].data_nm]
		updateSelf= false
		for sub_r, changes of new_data
			for rec in changes
				switch rec.verb
					when 'add'
						main_r[sub_r+'_idx'][rec.id]= rec.after
					when 'update'
						if not updateSelf
							updateSelf= @self_id and resource is 'Clinic' and sub_r is 'users' and rec.id is @self_id
						_log2 f, {main_r, sub_r, rec}
						$.extend  main_r[sub_r+'_idx'][rec.id], rec.after
					when 'delete'
						delete main_r[sub_r+'_idx'][rec.id]
			# Update list version of sub resource after updating indexed version
			if $.isArray main_r[sub_r]
				main_r[sub_r]= (rec for id,rec of main_r[sub_r+'_idx'])
			else
				main_r[sub_r]= main_r[sub_r+'_idx'][main_r[sub_r].id]
		for cb in @c_dataset[ dataset].cb
			cb resource, data # TODO RESOURCE IS ABIGUOUS IF NOT SAME AS DATASET; ADD PARAMS?
		if updateSelf
			for cb in @c_dataset[ @allowed.Self.data_nm].cb
				self= @c_dataset.user.data.user[ 0]
				$.extend self, data.clinic.users_idx[ @self_id] # Keep /User/me values
				cb 'Self', user: [ self]

E.Extra.Cache= Cache # Public API
