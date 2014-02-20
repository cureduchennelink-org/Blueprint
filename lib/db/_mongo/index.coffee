#
#	Mongo Database Object
#
#	Include Resource Specific DB functions for MongoDB Here

workout= require './models/workout'
{MCore}= require './model_core'

class Mongo
	constructor: (config, log) ->
		@Workout= workout
		@mcore= new MCore log

exports.Mongo = Mongo