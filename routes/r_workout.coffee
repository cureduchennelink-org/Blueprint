#
# Workout Routes
#
# Author: Jamie Hollowell
#
# @param db
# @param log
#

Q= require 'q'
E= require '../lib/error'

odb= false # Mongo DB
sdb= false # MySql DB

caller=
	get:		name: 'workout_get', 	 auth_required: true
	create: 	name: 'workout_create', auth_required: true

class Workout
	constructor: (db, wrapper, log)->
		log.info 'Initializing Workout Routes...'
		odb= db.mongo
		sdb= db.mysql

		# Public I/F
		@get= wrapper.read_wrap caller.get, @_get
		@createWorkout= wrapper.update_wrap caller.create, @_create

	# Private Logic
	_get: (conn, p, pre_loaded, _log)->
		f= route: 'workout_get'
		_log.debug f, p

		Q.resolve()
		.then ->

			odb.mcore.find odb.Workout, {}
		.then (docs)->
			send: workouts: docs

	_create: (conn, p, pre_loaded, _log)->
		f= 'User.mongoCreate'
		newWorkout= false
		opts= name: p.workout_name, description: p.description, type: p.type

		throw new E.InvalidArg 'Invalid Description','description' if not p.description
		throw new E.InvalidArg 'Invalid Name','workout_name' if not p.workout_name
		throw new E.InvalidArg 'Invalid Type','type' if not p.type

		Q.resolve()
		.then ->

			# Search for an Existing Workout
			odb.Workout.FindByName p.workout_name
		.then (docs)->
			_log.debug 'got docs:', docs
			if docs.length > 0
				throw new E.AccessDenied 'Name already exists', name: p.workout_name

			newWorkout= new odb.Workout opts
			_log.debug 'typeName:', newWorkout.typeName
			newWorkout.FindSimilarTypes()
		.then (docs)->
			_log.debug 'got similar Types:', docs

			# Create new Workout
			odb.mcore.create odb.Workout, opts
		.then ->
			send: success: true, message: 'Workout created with name:' + newWorkout.name

exports.Workout= Workout








