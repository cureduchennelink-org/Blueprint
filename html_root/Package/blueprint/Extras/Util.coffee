# Supports the EpicMvc BaseDevl Package Debug Pulldown
# Add to the content watcher array in Epic.run() command
bdvel_watcher= ()->
	$dur= "medium"; # Duration of Animation
	$(".dbg-toolbar").css {"right" : 0, "top" : -46 }
	$(".dbg-toolbar").hover ()->
		$(this).stop().animate({top : -7 }, $dur)
	, ()-> $(this).stop().animate {top : -46 }, $dur
	$(".dbg-toolbar").show()

# Content Watcher Pluggin to Filtering characters
# Add to the content watcher array in Epic.run() command
# <input class="filter-chars-input" data-filter-chars-name="myName" />
# <table class="filter-chars-myName">
#      <tr class="filter-chars" data-filter-chars="~name~phone~city~">
filter_chars_pluggin= (container)->
	f= 'filter_chars_plugin'
	# _log2 f, container
	return window.filter_chars_globals= {} if container is 'RESET' # Clear namespace values
	f= 'filter_chars_plugin'
	$('.filter-chars-input', container)
	.on "keyup", (event_obj)->
		nm= $(this).attr "data-filter-chars-name"
		filter_chars_globals[nm]= $(this).val()
		filter_chars nm
	.each ()->
		nm= $(this).attr "data-filter-chars-name"
		filter_chars_globals[nm]?= ''
		$(this).val filter_chars_globals[nm]
		# DOING THIS REGARDLESS OF INPUT SHOWING UP WITH IT'S CONTENT: filter_chars nm

	# Add detection for inserting dynamic rows when the input is not dynamic, or not in same 'container' content update
	prefix= 'filter-chars-'
	$(".filter-chars-container", container)
	.each () ->
		nm= $(this).attr "data-filter-chars-name"
		_log2 f, 'nm,class', nm, $(this).attr 'class'
		filter_chars nm, $(this)

	$('.filter-chars-clear', container)
	.on "click", (event_obj)->
		nm= $(this).attr "data-filter-chars-name"
		filter_chars_globals[nm]= ''
		$(".filter-chars-input[data-filter-chars-name='#{nm}']").val ''
		filter_chars nm
		return false


filter_chars= (nm, ctx) ->
	f= 'E/Util:filter_chars:'
	# _log2 f, nm
	str= window.filter_chars_globals[nm]
	ctx?= $ ".filter-chars-container[data-filter-chars-name='#{nm}']"
	rows= $ '.filter-chars', (ctx ? document)
	if str.length is 0
		rows.show()
		return
	pattern= new RegExp str,'i'
	rows.each ()->
		e= $ @
		parts= e.attr 'data-filter-chars'
		if (parts.search pattern) isnt -1
			e.show()
		else
			e.hide()

custom_filter= (val,spec) ->
	f= 'E/Util:filter:'
	# _log2 f, val, spec
	[func,p1,p2,p3]= spec.split ':'
	switch func
		when 'tz'
			(val.replace '$', '/').replace /_/g, ' '
		when 'html'
			switch p1
				when 'id'
					return (( val ? '').replace ' ', '_').replace /[^a-z_0-9-]/gi, ''
				else BROKEN_FILT_HTML_P1_UNKNOWN()
		when 'para'
			'<p>'+ (( val ? '').split '\n').join '</p><p>'+ '</p>' # Assume newlines deliniate paragraphs
		when 'phone'
			return '' if val is 'null' or val is '000-000-0000' or val is null
			return val
			# val= val.replace /[^0-9]/g, ''# TODO: Remove if needed to handle international dates
			# return val unless val?.length
			# val.replace /(...)(...)(...)/, '($1) $2-$3'
		when 'age'
			return '' if val is 'null' or val is '0000-00-00' or val is null
			return val unless val?.length
			# [y,m,d]= ( val.split 'T')[0].split '-'
			now= new Date().getTime()
			age=( now- Date.parse val)/( 60* 60* 24* 365.25) # TODO: Not 100% accurate.
			_log2 f, 'now/age', now, age
			Math.floor age/ 1000
		when 'date'
			return '' if val is 'null' or val is null or val is ''
			return '' if val is '0000-00-00' or val is '0000-00-00 00:00:00'
			return '!!' unless val?.length
			[date, time]= val.split 'T'
			[y,m,d]= date.split '-'
			result=
				if p1 is 'long'
					mmap= ['0', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June',
						'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec']
					"#{mmap[ Number m]} #{d}, #{y}"
				else if p1 is 'detail'
					val # TODO
				else if p1 is 'format'
					oDate= moment val
					oDate.format p2.replace /_/g, ':'
				else
					"#{m}/#{d}/#{y}"
			result=
			if p2 is 'time'
				result+= ' '+ time.slice 0, 8
			else
				result
			result ? '!'
		when 'to_upper'
			val.toUpperCase()
		when 'mbytes'
			if typeof val is 'number'
				mbytes= val / 1024 / 1014
				mbytes= mbytes.toFixed 2
				return "#{mbytes} MB"
			else
				return ""
		when 'duration' # val= durationInSeconds
			s= (Number val) + 30 # +30 Rounds up minutes
			hd= Math.floor(s/3600)
			s-= hd*3600
			md= Math.floor(s/60)
			hd= '0'+hd if hd < 10
			md= '0'+md if md < 10
			return "#{hd}:#{md}"

CHECK_birthDate= (fieldName, validateExpr, value, oF) ->
	f= 'E/Util:CHECK_birthDate:'
	# _log2 f, fieldName, validateExpr, value, oF
	patt=new RegExp("^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
	check= patt.test(value)
	return check unless check
	true # TODO: check for a valid date parse

CHECK_phoneAny= (fieldName, validateExpr, value, oF) ->
	f= 'E/Util:CHECK_phoneAny:'
	value= value.replace /[^0-9]/g, ''
	return value.length > 9

D2H_html5date= (fieldName, filtExpr, value) ->
	if value?.length > 11
		[date, time]= value.split 'T'
		date
	else
		value

window.bdvel_watcher= bdvel_watcher
window.filter_chars_globals= {}
window.filter_chars_pluggin= filter_chars_pluggin
window.EpicMvc.custom_filter= custom_filter # For &Table/column##filter-spec; processing
window.EpicMvc.FistFilt.CHECK_birthDate= CHECK_birthDate
window.EpicMvc.FistFilt.CHECK_phoneAny= CHECK_phoneAny
window.EpicMvc.FistFilt.D2H_html5date= D2H_html5date
