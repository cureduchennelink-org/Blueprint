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
		_t= @
		Obj= ->
			c_args=[_t]
			c_args.push arg for arg in args ? []
			constructor.apply this, c_args

		Obj.prototype= constructor.prototype
		@services[name]= new Obj

	add_route_service: (name, obj)->
		@routes[name]= obj

	new_route_service: (name, constructor, args)->
		_t= @
		Obj= ->
			c_args=[_t]
			c_args.push arg for arg in args ? []
			constructor.apply this, c_args

		Obj.prototype= constructor.prototype
		@routes[name]= new Obj

exports.Kit= Kit