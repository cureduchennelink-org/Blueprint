#
#	Route Pre-Loader
#
#	kit dependencies:
#		db.mysql
#		logger.log.[debug,info]

Q= require 'q'

log_map=
	get:  'GET '
	post: 'POST'
	put:  'PUT '
	del:  'DEL '

use_map=
	get:  'GET'
	post: 'POST'
	put:  'PUT'
	del:  'DEL'

usage= []

class Router
	constructor: (kit) ->
		kit.services.logger.log.info 'Initializing Router...'
		@log= 		kit.services.logger.log
		@pfx= 		kit.services.config.route_prefix.api
		@template= 	kit.services.template_use
		@server= 	kit.services.server
		@usage= []

	add_route: (verb, route, func)->
		@usage.push verb:use_map[verb], route: route, Param: (name: nm, format: val for nm,val of func 'use')
		verbs= [verb]
		verbs.push 'post' if verb in ['del','put']
		for v in verbs
			@log.info '\t', log_map[v], route
			@server[v] @pfx + '' + route, func

	make_tbl: ()->
		Route: (rec for rec in @usage)

	route_usage: ()=>
		f= 'Router:route_usage'
		@server.get @pfx, (q,r,n)=>
			if q.params.format is 'json'
				r.send @usage
			else
				try
					result= @template.render 'Usage','Top','welcome', @make_tbl()
				catch e
					@log.debug e, e.stack
					throw e
				r.set 'Content-Type', 'text/html'
				r.send 200, result, {'Content-Type':'text/html; charset=utf-8'}
			n()

exports.Router= Router