#
#	Various Request Processing Functions for server.use
#
#

# Debug Line
exports.debug_request= (req, res, next) ->
	req.log.info 'ROUTE:', req.url, req.method
	req.log.info 'PARAM:', req.params[p] for p of req.params
	return next()

# Set Response Headers to avoid CORS issues
exports.set_response_headers= (req, res, next) ->
	res.setHeader 'Access-Control-Allow-Credentials', 'true'
	res.setHeader 'Access-Control-Allow-Origin',( req.headers.origin || '*')
	return next()