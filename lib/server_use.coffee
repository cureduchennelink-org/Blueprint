#
#	Various Request Processing Functions for server.use
#
#

# Debug Line
exports.debug_request= (req, res, next) ->
	req.log.info 'ROUTE:', req.method, req.url
	(req.log.info 'PARAM:', nm + ':', val) for nm, val of req.params when nm not in ['_']
	return next()

# Set Response Headers to avoid CORS issues
exports.set_response_headers= (req, res, next) ->
	res.setHeader 'Access-Control-Allow-Credentials', 'true'
	res.setHeader 'Access-Control-Allow-Origin',( req.headers.origin || '*')
	return next()