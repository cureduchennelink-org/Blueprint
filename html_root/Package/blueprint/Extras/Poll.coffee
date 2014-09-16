
# A cheap REST Long-poll method

class Poll
	constructor: (@endpoint,@cb) ->
		f= 'Poll::constructor'
		#_log2 f
		@rest= window.rest_v1
		@resource= 'Poll'
		@retry= 500
		@retry_max= 30000
		@xhr= false
		@pending= false # A setTimeout is going?
		@abort= false # True to suspend all activity
		@auth_req= window.EpicMvc.Extras.options.poll.auth_req
		@state= {}
		@listen= {}
	Listen: (name, push_handle) => # Use push_handle=false to remove
		_log2 'Poll:Listen:', name, push_handle, (if @xhr isnt false then 'running' else 'not-running')
		if push_handle is false
			delete @listen[name]
		else
			@listen[name]= push_handle # Add
		(@xhr.abort(); @xhr= false) if @xhr isnt false
		@abort= false
		@Start()
	Stop: (preserve_state)->
		f= 'E:Poll:Stop:'
		_log2 f, pending: @pending, (if @xhr isnt false then 'running' else 'not-running')
		@abort= true # Before xhr.abort() to signal to not try again
		(clearTimeout @pending; @pending= false) if @pending isnt false
		(@xhr.abort(); @xhr= false) if @xhr isnt false
		@state= {}; @listen= {} unless preserve_state is true
	Start: (delay) =>
		f= 'Poll::Start'
		_log2 f, delay or 'no-delay', @cursor or 'no@cursor', (if @xhr then 'running' else 'not-running'), if @pending then 'pending' else 'not-pending'
		(@abort= false; delay= @retry) if delay is true # Special case, un-suspend activity
		return if @pending isnt false or @xhr isnt false or @abort is true
		delay?= @retry
		delay= @retry_max if delay> @retry_max
		options=
			cache: false, async: true, timeout: 0, type: 'post'
			dataType: 'json'
			#TODO SETTING CONTENT-TYPE TO JSON CAUSES PRE_FLIGHT, NEED TO SIMULATE IT IN RESTIFY?
			# contentType: 'application/json'
			url: @endpoint+ @resource
			success: (data) =>
				@xhr= false
				#_log f, ' data=', data
				return if @abort is true
				again= @cb data
				@state= data.state if data.state?
				@listen= data.listen if data.listen?
				@Start() if again
				return
			error: (jqXHR, textStatus, errorThrown) =>
				@xhr= false
				#_log f, ' delay=', delay
				_log2 f, ' AJAX ERROR', jq:jqXHR, ts:textStatus, et:errorThrown
				return if @abort is true
				if errorThrown is 'Unauthorized' then @rest.DoToken()
				@Start delay* 2 # Back off exponentially
				return
		@pending= setTimeout =>
			#_log2 f, '::setTimeout', options.data
			@pending= false
			return if @abort is true
			# Get the very latest token availble
			token= @rest.CurrentToken()
			if @auth_req
				return if token is false # Logged out, I guess?
				#options.headers= Authorization: "#{token.token_type} #{token.access_token}"
				# Note: to enable auth_token, you should also comment out 'contentType' above
				options.url+= '?auth_token='+ encodeURIComponent "#{token.access_token}"
			options.data= JSON: (JSON.stringify state: @state, listen: @listen)
			@xhr= $.ajax options
		, delay
		return

window.EpicMvc.Extras.Poll= Poll # Public API
