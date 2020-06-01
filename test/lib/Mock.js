#
#	Mock Clases
#

# Mock Restify Requests
class RestifyRequest
	constructor: (opts)->
		@headers= 		opts?.headers || {}
		@url= 			opts?.url || {}
		@method= 		opts?.method || {}
		@statusCode= 	opts?.statusCode || {}
		@params= 		opts?.params || {}
exports.RestifyRequest= RestifyRequest

# Mock Restify Responses
class RestifyResponse
	constructor: (opts)->
		@headers= opts?.headers || {}
	setHeader: (nm, val)-> @headers[nm]= val
	send: (data)-> @data= data
exports.RestifyResponse= RestifyResponse