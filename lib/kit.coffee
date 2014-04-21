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
		_services= @services
		Obj= ->
			c_args=[_services]
			c_args.push arg for arg in args ? []
			constructor.apply this, c_args

		Obj.prototype= constructor.prototype
		@services[name]= new Obj

	new_route_service: (name, constructor)->
		_services= @services
		Obj= ->
			constructor.apply this, [_services]

		Obj.prototype= constructor.prototype
		@routes[name]= new Obj

exports.Kit= Kit