#
#	Route Pre-Loader
#

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

class Router
	@deps: services: ['template_use', 'server'], config: 'route_prefix.api'
	constructor: (kit) ->
		@log= 		kit.services.logger.log
		@pfx= 		kit.services.config.route_prefix.api
		@template= 	kit.services.template_use
		@server= 	kit.services.server.server
		@usage= []
		@usage_by_mod= {}

	AddRoute: (mod, name, verb, route, func)->
		@usage_by_mod[mod]= [] unless @usage_by_mod[mod]
		use_spec= func 'use'
		use_rec=
			name: name
			verb: use_map[verb]
			route: route
			Param: (name: nm, format: val for nm,val of use_spec.params)
			Response: (name: nm, format: val for nm,val of use_spec.response)
		@usage_by_mod[mod].push use_rec
		@usage.push use_rec
		verbs= [verb]
		verbs.push 'post' if verb in ['del','put']
		for v in verbs
			@log.info '\t', log_map[v], @pfx + '' + route
			@server[v] @pfx + '' + route, func

	make_tbl: ()->
		table= Module: []
		for mod, route_list of @usage_by_mod
			table.Module.push name: mod, Route: (route for route in route_list)
		table

	server_init: ()=>
		f= 'Router:server_init'
		@server['get'] @pfx, (q,r,n)=>
			if q.params.format is 'json'
				r.send @usage
			else
				try
					body= @template.render 'Usage','Usage','usage_main', @make_tbl()
				catch e
					@log.debug e, e.stack
					throw e
				r.writeHead 200,
					'Content-Length': Buffer.byteLength body
					'Content-Type': 'text/html; charset=utf-8'
				r.write body
				r.end()
			n()

exports.Router= Router
