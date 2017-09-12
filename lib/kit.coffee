#
# Kit Object. Dependency Manager
#
# Author: Jamie Hollowell
#

class Kit
	constructor: ()->
		@services= {}
		@routes= {}

	get_service_deps_needed: (name, constructor)-> # Look at deps.services and remove any already in @services
		d= constructor.deps
		throw new Error "Module '#{name}' is missing @deps - "+ JSON.stringify constructor unless d
		needed= []
		for nm in d.services or []
			needed.push nm unless nm of @services

	add_service: (name, obj)->
		@services[name]= obj

	new_service: (name, constructor, args)=>
		d= constructor.deps
		console.log 'Kit::new_service: '+ name, d
		throw new Error "Service-Module '#{name}' is missing @deps" unless d
		needs= d.services ? []
		needs.push 'db' if d.mysql or d.mongo
		throw new Error "Service-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
		_t= @
		_a= args ? []
		@services[name]= new constructor _t, _a...

	add_route_service: (name, obj)->
		@routes[name]= obj

	new_route_service: (name, constructor, args)->
		d= constructor.deps
		console.log 'Kit::new_route_service: '+ name, d
		throw new Error "Route-Module '#{name}' is missing @deps" unless d
		needs= d.services ? []
		needs.push 'wrapper'
		throw new Error "Route-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
		_t= @
		_a= args ? []
		@routes[name]= new constructor _t, _a...

exports.Kit= Kit
