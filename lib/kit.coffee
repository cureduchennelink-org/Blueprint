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

	new_service: (name, constructor)->
		_services= @services
		Obj= ->
			constructor.apply this, [_services]

		Obj.prototype= constructor.prototype
		@services[name]= new Obj

# 	make_object: (name, fn, args)->
# 		deps= (@services[nm] for nm in args)
# 		@services[name]= fn.apply this, deps

	new_route_service: (name, constructor)->
		_services= @services
		Obj= ->
			constructor.apply this, [_services]

		Obj.prototype= constructor.prototype
		@routes[name]= new Obj

exports.Kit= Kit