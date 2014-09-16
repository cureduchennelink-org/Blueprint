#
#	REST API Module
#

class RestAPI
	constructor: (host, port, pfx, version)->
		port= (String port)
		port= ':' + port if port.length
		pfx= '/' + pfx if pfx.length
		version= '/' + version if version.length
		@route_prefix= "//#{host}#{port}#{pfx}#{version}/"
		@Epic= window.EpicMvc.Epic # TODO: Pass in to constructor
		@error= statusCode: true # Assume we were good last time
		@token= false
		@refresh_timer= false
		@auth_user= false
		@auth_web_client= 'web-client'
		LocalCache= new window.EpicMvc.Extras.LocalCache
		@localCache= -> LocalCache

	CurrentToken: ()-> @token
	GetPrefix: ()-> @route_prefix
	MakeIssue: (i, result, p)->
		f= 'RestAPI:MakeIssue:'
		_log2 f, i, result, p
		token= 'UNRECOGNIZED'
		params= []
		if 'error' of result
			token= result.error.replace /:/g, '_'
			params.push param for nm,param of result when nm isnt 'error'
		if token is 'UNRECOGNIZED' and 'message' of result
			if /EACCES/.test result.message
				token= 'CPC_SPAWN_ERROR'
			if /Command failed:/.test result.message
				token= 'CPC_CMD_ERROR'
			params.push result.message.split('(')[0]
		params.push result.message if token is 'UNRECOGNIZED'
		params.push param for param in p or []
		i.add token, params

	# rest_v1.get 'User', f, data
	Post: (r,s,d) -> @request 'POST', r, s, d
	Get:  (r,s,d) -> @request 'GET', r, s, d
	Request: (type, route, debug_source, data)=>
		f= "RestAPI:request:" # #{debug_source}:#{type}:#{route}:
		_log2 f, data, debug_source: debug_source, type: type, route: route
		result= false
		data?= {}
		if @token is false
			click_data= {type, route, debug_source, data}
			click_data.errorThrown= 'TOKEN_FALSE'
			setTimeout ()=>
				@Epic.makeClick false, 'async_restErr_401', click_data, false
			, 0
			return null
		data.auth_token= @token.access_token
		result= @DoData type, route, debug_source, data
		if result is false
			if @error.errorThrown.name is 'NetworkError'
				result= error: @error.errorThrown.name, message: @error.errorThrown.message
			else
				result= JSON.parse @error.jqXHR.responseText
			# TODO: if result is an expired token, DoToken then DoData again
			if result.error and result.error is 'invalid_token'
				click_data= {type, route, debug_source, data, result}
				setTimeout ()=>
					@Epic.makeClick false, 'security_rest1', click_data, false
				, 0
		return result

	NoAuthGet:  (r,s,d)-> @NoAuthRequest 'GET', r, s, d
	NoAuthPost: (r,s,d)-> @NoAuthRequest 'POST', r, s, d
	NoAuthRequest: (type, route, debug_source, data)=>
		f= "RestAPI:NoAuthRequest:" # #{debug_source}:#{type}:#{route}:
		_log2 f, data, debug_source: debug_source, type: type, route: route
		result= false
		data?= {}
		result= @DoData type, route, debug_source, data
		if result is false
			if @error.errorThrown.name is 'NetworkError'
				result= error: @error.errorThrown.name, message: @error.errorThrown.message
			else
				result= JSON.parse @error.jqXHR.responseText
		return result

	DoData: (type, route, debug_source, data)=>
		f= "RestAPI:DoData:" # #{debug_source}:#{type}:#{route}:
		_log2 f, data, debug_source: debug_source, type: type, route: route
		result= false
		@error= statusCode: true
		$.ajax
			url: @route_prefix + route
			data: data
			type: type
			dataType: 'json'
			async: false
			cache: false
		.done (data, textStatus, jqXHR)->
			result= data
		.fail (jqXHR, textStatus, errorThrown)=>
			statusCode= if typeof errorThrown is 'string' then errorThrown else errorThrown.name
			@error= {statusCode, jqXHR, textStatus, errorThrown }
		return result
	DoToken: (pass) ->
		f= 'E:Rest:DoToken:'
		_log2 f, pass, @token
		if pass # Only a fresh login
			@token= @DoData 'POST', 'Auth', f+'user/pass',
				username: @auth_user
				password: pass
				grant_type: 'password'
				client_id: @auth_web_client
		else # Attempt a refresh token
			# TODO Consider avoiding extra refresh when others call this function: return @token if @token isnt false and @refresh_timer isnt false
			if @token is false # Try to load from storage #TODO USE SESSION STORAGE IF USER DOESN'T WANT 'REMEMBER ME'
				@localCache().Restore()
				rtoken= @localCache().Get 'auth_rtoken'
				(@token= refresh_token: rtoken) if rtoken?.length
			if @token
				@token= @DoData 'POST', 'Auth', f+'refresh',
					refresh_token: @token.refresh_token
					grant_type: 'refresh_token'
					client_id: @auth_web_client
		if @token
			# Refresh the refresh_token; hold for browser refresh/restart
			if pass
				@localCache().Login auth_rtoken: @token.refresh_token
			else
				@localCache().Put 'auth_rtoken', @token.refresh_token
			if @refresh_timer is false
				@refresh_timer= setTimeout (=> @refresh_timer= false; @DoToken()), (@token.expires_in- 10)* 1000
		else if @statusCode is 'Unauthorized' and not pass # Unload any previously stored, not useful rtoken
			@localCache().Logout()
			(clearTimeout @refresh_timer; @refresh_timer= false) if @refresh_timer isnt false
			window.EpicMvc.Epic.logout 'Security.rest1', {}
		_log2 f, '@token/statusCode/rtoken', @token, @statusCode, rtoken
		@token # return false if it did not work

	GetS3File: (s3key, start, length, dir, cb) -> #TODO MAKE MORE CONFIGURABLE @s3_prefix? ADD SECURITY?
		f= "E/RestAPI.getEwt:"
		_log2 f, 'top', {s3key, start, length}
		xhr= new XMLHttpRequest()
		xhr.onloadend= (e) -> cb e.target.response # a blob
			#if e.?.status is 200 # TODO HANDLE ERROR CONDITIONS
			#then cb response # a blob
			#else
				#_log2 f, 'fail', xhr
				#cb response # TODO OR cb false
		#xhr.onprogress= (e) -> cb 'progress', e.loaded, e.total
		# Add event listeners *before* open
		@s3_prefix= "http://s3.amazonaws.com/#{dir}/"
		cache_bust= '?_='+ new Date().valueOf()
		url= @s3_prefix+ s3key+ cache_bust # TODO DETERMINE IF THIS IS EVER NEEDED (RECALC?)
		xhr.open 'GET', url, true
		xhr.setRequestHeader 'Range', "bytes=#{start}-#{start+ length- 1}"
		xhr.responseType= 'blob'
		xhr.send()
		return xhr

	Login: (auth_user,pass) -> # Return false if not successful; persists auth_user (allow missing pass to set default email)
		@logout()
		@auth_user= auth_user
		@localCache().QuickPut 'auth_user', @auth_user
		@DoToken pass if pass # Will be false if not a valid login
	Logout: () ->
		@auth_user= @token= false
		@localCache().Logout()
		(clearTimeout @refresh_timer; @refresh_timer= false) if @refresh_timer isnt false
		return

	GetMap: (resource, sub_resource)->
		# TODO: Get maps from the server
		@resource_map=
			user:
				status:
					ACTIVE:		token: 'ACTIVE',   nice: 'Active'
					INACTIVE:	token: 'INACTIVE', nice: 'Inactive'

		if sub_resource?.length
			@resource_map[resource][sub_resource]
		else
			@resource_map[resource]

window.EpicMvc.Extras.RestAPI= RestAPI

