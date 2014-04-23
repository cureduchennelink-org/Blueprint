#
#	Route Pre-Loader
#
#	kit dependencies:
#		db.mysql
#		logger.log.[debug,info]

Q= require 'q'

v_map=
	get:  'GET'
	post: 'POST'
	put:  'PUT'
	del:  'DEL'

class Router
	constructor: (kit) ->
		kit.services.logger.log.info 'Initializing Router...'
		@log= kit.services.logger.log
		@usage= {}
		@pfx= kit.services.config.route_prefix.api
		@server= kit.services.server

	add_route: (verb, route, func)->
		@usage[v_map[verb]+': '+route]= func 'use'
		verbs= [verb]
		verbs.push 'post' if verb in ['del','put']
		for v in verbs
			@log.info v_map[v], route
			@server[v] @pfx + '' + route, func

	route_usage: ()=>
		@server.get @pfx, (q,r,n)=> r.send @usage; n()

exports.Router= Router