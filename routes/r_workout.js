#
# Workout Routes
#
# Author: Jamie Hollowell
#
Promise= require 'blueprint'

class Workout
	constructor: (kit)->
		kit.services.logger.log.info 'Initializing Workout Routes...'
		@E= kit.services.error
		@odb= kit.services.db.mongo

		@endpoints=
			get:
				verb: 'get', route: '/Workout'
				use: true, wrap: 'default_wrap', version: any: @_get
				auth_required: true
			create:
				verb: 'post', route: '/Workout'
				use: true, wrap: 'default_wrap', version: any: @_create
				auth_required: true

	# Private Logic
	_get: (ctx, pre_loaded)=>
		use_docs= {}
		return use_docs if ctx is 'use'
		f= 'Workout:_get:'
		p= 	  ctx.p

		ctx.log.debug f, p

		Promise.resolve().bind @
		.then ->

			@odb.core.find @odb.Workout, {}
		.then (docs)->
			send: workouts: docs

	_create: (ctx, pre_loaded)=>
		use_docs= description: 'rS', workout_name: 'rS', type: 'rE:good,bad'
		return use_docs if ctx is 'use'
		f= 'Workout:_create:'
		p= 	  ctx.p

		newWorkout= false
		opts= name: p.workout_name, description: p.description, type: p.type

		throw new @E.MissingArg 'description' if not p.description
		throw new @E.MissingArg 'workout_name' if not p.workout_name
		throw new @E.MissingArg 'type' if not p.type

		Promise.resolve().bind @
		.then ->

			# Search for an Existing Workout
			@odb.Workout.FindByName p.workout_name
		.then (docs)->
			ctx.log.debug 'got docs:', docs
			if docs.length > 0
				throw new @E.AccessDenied 'Name already exists', name: p.workout_name

			newWorkout= new @odb.Workout opts
			ctx.log.debug 'typeName:', newWorkout.typeName
			newWorkout.FindSimilarTypes()
		.then (docs)->
			ctx.log.debug 'got similar Types:', docs

			# Create new Workout
			@odb.core.create @odb.Workout, opts
		.then ->
			send: success: true, message: 'Workout created with name:' + newWorkout.name

exports.Workout= Workout
