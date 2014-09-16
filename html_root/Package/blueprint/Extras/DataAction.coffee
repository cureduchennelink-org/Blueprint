# Make HTML elements clickable via data-attributes
# <input name="search" data-action="click:upload_study::false"/>

$(document).on "click change dblclick", "[data-action]", (event_obj)->
	f= 'E/DataAction:'
	console.log f, 'got a click!'
	aspecs= $(this).attr("data-action").split ','
	dparams= JSON.parse($(this).attr("data-params") or "{}")
	for aspec in aspecs
		spec= aspec.split ':'
		if spec[0] is event_obj.type
			form_flag= spec[2] is 'true' # Default false
			render_flag= not (spec[3] is 'false') # Default true
			action= spec[1]
			params= $.extend {input_obj: @}, dparams
			((form_flag, render_flag, action, params)->
				setTimeout ()->
					i= window.EpicMvc.Epic.makeClick form_flag, action, params, render_flag
				, 5
			)(form_flag, render_flag, action, params)
			return false