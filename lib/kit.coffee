#
# Kit Object. Dependency Manager
#
# Author: Jamie Hollowell
#

class Kit
	constructor: ()->
		@services= {}
		@routes= {}

	add_service: (name, obj)->
		@services[name]= obj

	new_service: (name, constructor, args)=>
		d= constructor.deps
		#console.log 'new_service: '+ name, d
		throw new Error "Module '#{name}' is missing @deps" unless d
		needs= d.services ? []
		needs.push 'db' if d.mysql or d.mongo
		throw new Error "Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
		_t= @
		_a= args ? []
		@services[name]= new constructor _t, _a...

	add_route_service: (name, obj)->
		@routes[name]= obj

	new_route_service: (name, constructor, args)->
		_t= @
		_a= args ? []
		@routes[name]= new constructor _t, _a...

exports.Kit= Kit
