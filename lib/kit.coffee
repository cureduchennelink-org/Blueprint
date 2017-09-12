#
# Kit Object. Dependency Manager
#
# Author: Jamie Hollowell
#
_log= debug: console.log # Until a logger service is added

class Kit
	constructor: ()->
		@services= {}
		@routes= {}

	get_service_deps_needed: (name, constructor)-> # Look at deps.services and remove any already in @services
		f= 'Kit::get_service_deps_needed: '
		d= constructor.deps
		#_log.debug f, {name, d, constructor}
		throw new Error f+ "Module '#{name}' is missing @deps - "+ JSON.stringify constructor unless d
		needed= []
		for nm in (d.services or [])
			needed.push nm unless nm of @services
		needed.push 'db' if d.mysql or d.mongo
		needed

	add_service: (name, obj)->
		@services[ name]= obj
		_log= @services[ name].log if name is 'logger'
		return @services[ name]

	new_service: (name, constructor, args)=>
		f= 'Kit::new_service: '
		d= constructor.deps
		#_log.debug f+ name, d
		throw new Error f+ "Service-Module '#{name}' is missing @deps" unless d
		needs= d.services ? []
		needs.push 'db' if d.mysql or d.mongo
		throw new Error f+ "Service-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
		_t= @
		_a= args ? []
		@services[ name]= new constructor _t, _a...
		_log= @services[ name].log if name is 'logger'
		return @services[ name]

	add_route_service: (name, obj)->
		@routes[name]= obj

	new_route_service: (name, constructor, args)->
		f= 'Kit::new_route_service: '
		d= constructor.deps
		#_log.debug f+ name, d
		throw new Error f+ "Route-Module '#{name}' is missing @deps" unless d
		needs= d.services ? []
		needs.push 'wrapper'
		throw new Error f+ "Route-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
		_t= @
		_a= args ? []
		@routes[name]= new constructor _t, _a...

exports.Kit= Kit
