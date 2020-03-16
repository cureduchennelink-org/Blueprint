class Interceptor
	@deps= services: ['logger']
	constructor: (kit)->
		@logger = kit.services.logger

	# Runs before server starts listening
	intercept: (agent)=>
		agent.interceptors.request.use (config) -> # Add a request interceptor
			f= 'interceptors.request.BEFORE'            
			# Do something before request is sent            
			#ctx.log.debug f, {config}            
			logger.log.debug f,            
				timeout: config.timeout                			
				headers_common: config.headers.common                			
				method: config.method                			
				headers_method: config.headers[ config.method]                			
				baseURL: config.baseURL                			
				url: config.url                			
				data: config.data                			
			config            
		, (error) ->        			
			f= 'interceptors.request.ERROR'    			        			
			# Do something with request error    			        			
			logger.log.debug f, {error}    			        			
			Promise.reject error    			        			
		agent.interceptors.response.use (response) -> # Add a response interceptor        			
			f= 'interceptors.response.AFTER'            						
			# Do something with response data            						
			#ctx.log.debug f, {response}            						
			logger.log.debug f,            						
				status: response.status                					
				headers_set_cookie: response.headers[ 'set-cookie']                					
				request_ClientRequest__header: response.request._header                					
				data: response.data                					
			response            						
		, (error) ->        			
			f= 'interceptors.response.ERROR'    			        			
			# Do something with response error    			        			
			logger.log.debug f, {error} unless error.conig    			        			
			logger.log.debug f,    			        			
				response: error.response        		        			
				_header: error.request._header        		        			
			Promise.reject error    			        			
		logger = @logger        			
        
exports.Interceptor = Interceptor