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

	new_service: (name, constructor, args)->
		console.log {constructor}
		_t= @
		_a= args ? []
		@services[name]= new constructor _t, _a...

	add_route_service: (name, obj)->
		@routes[name]= obj

	new_route_service: (name, constructor, args)->
		console.log {constructor}
		_t= @
		_a= args ? []
		@routes[name]= new constructor _t, _a...

exports.Kit= Kit
