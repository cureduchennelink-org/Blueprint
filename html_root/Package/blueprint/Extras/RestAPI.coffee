#
#	REST API Module
#
# rest_v1= new EpicMvc.Extras.RestAPI 'localhost', 9500, 'api', 'v1'
class RestAPI
	constructor: (host, port, pfx, version)->
		port= (String port)
		port= ':' + port if port.length
		pfx= '/' + pfx if pfx.length
		version= '/' + version if version.length
		@route_prefix= "//#{host}#{port}#{pfx}#{version}/"

	# rest_v1.call 'GET', 'User', f, data
	call: (type, route, debug_source, data)->
		f= "RestAPI.call:#{debug_source}:#{type}:#{route}:"
		_log2 f, data
		result= false
		$.ajax
			url: @route_prefix + route
			data: data
			type: type
			dataType: 'json'
			async: false
			cache: false
		.done (data, textStatus, jqXHR)->
			result= data
		.fail (jqXHR, textStatus, errorThrown)->

			result= JSON.parse jqXHR.responseText
		return result

window.EpicMvc.Extras.RestAPI= RestAPI

