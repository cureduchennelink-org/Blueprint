/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
class Interceptor {
	static initClass() {
		this.deps= {services: ['logger']};
	}
	constructor(kit){
		this.intercept = this.intercept.bind(this);
		this.logger = kit.services.logger;
	}

	// Runs before server starts listening
	intercept(agent){
		let logger;
		agent.interceptors.request.use(function(config) { // Add a request interceptor
			const f= 'interceptors.request.BEFORE';            
			// Do something before request is sent            
			//ctx.log.debug f, {config}            
			logger.log.debug(f, {            
				timeout: config.timeout,                			
				headers_common: config.headers.common,                			
				method: config.method,                			
				headers_method: config.headers[ config.method],                			
				baseURL: config.baseURL,                			
				url: config.url,                			
				data: config.data
			}
			);                			
			return config;
		}            
		, function(error) {        			
			const f= 'interceptors.request.ERROR';    			        			
			// Do something with request error    			        			
			logger.log.debug(f, {error});    			        			
			return Promise.reject(error);
		});    			        			
		agent.interceptors.response.use(function(response) { // Add a response interceptor        			
			const f= 'interceptors.response.AFTER';            						
			// Do something with response data            						
			//ctx.log.debug f, {response}            						
			logger.log.debug(f, {            						
				status: response.status,                					
				headers_set_cookie: response.headers[ 'set-cookie'],                					
				request_ClientRequest__header: response.request._header,                					
				data: response.data
			}
			);                					
			return response;
		}            						
		, function(error) {        			
			const f= 'interceptors.response.ERROR';    			        			
			// Do something with response error    			        			
			if (!error.conig) { logger.log.debug(f, {error}); }    			        			
			logger.log.debug(f, {    			        			
				response: error.response,        		        			
				_header: error.request._header
			}
			);        		        			
			return Promise.reject(error);
		});    			        			
		return logger = this.logger;
	}
}
Interceptor.initClass();        			
        
exports.Interceptor = Interceptor;