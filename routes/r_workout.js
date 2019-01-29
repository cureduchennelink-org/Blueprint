/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Workout Routes
//
// Author: Jamie Hollowell
//
// 	kit dependencies:
//		db.[mysql,mongo]
//		wrapper
//		logger.log
//

const Q= require('q');
const E= require('../lib/error');

let odb= false; // Mongo DB
let sdb= false; // MySql DB


class Workout {
	constructor(kit){
		kit.services.logger.log.info('Initializing Workout Routes...');
		odb= kit.services.db.mongo;
		sdb= kit.services.db.mysql;
		this.endpoints= {
			get: {
				verb: 'get', route: '/Workout',
				use: true, wrap: 'default_wrap', version: { any: this._get
			},
				auth_required: true
			},
			create: {
				verb: 'post', route: '/Workout',
				use: true, wrap: 'default_wrap', version: { any: this._create
			},
				auth_required: true
			}
		};
	}

	// Private Logic
	_get(ctx, pre_loaded){
		const use_docs= {};
		if (ctx === 'use') { return use_docs; }
		const { p }= 	  ctx;
		const { conn }= ctx;
		const _log= ctx.log;

		const f= 'Workout:_get:';
		_log.debug(f, p);

		return Q.resolve()
		.then(() => odb.core.find(odb.Workout, {}))
		.then(docs=> ({send: {workouts: docs}}));
	}

	_create(ctx, pre_loaded){
		const use_docs= {description: 'rS', workout_name: 'rS', type: 'rE:good,bad'};
		if (ctx === 'use') { return use_docs; }
		const { p }= 	  ctx;
		const { conn }= ctx;
		const _log= ctx.log;

		const f= 'Workout:_create:';
		let newWorkout= false;
		const opts= {name: p.workout_name, description: p.description, type: p.type};

		if (!p.description) { throw new E.MissingArg('description'); }
		if (!p.workout_name) { throw new E.MissingArg('workout_name'); }
		if (!p.type) { throw new E.MissingArg('type'); }

		return Q.resolve()
		.then(() =>

			// Search for an Existing Workout
			odb.Workout.FindByName(p.workout_name)).then(function(docs){
			_log.debug('got docs:', docs);
			if (docs.length > 0) {
				throw new E.AccessDenied('Name already exists', {name: p.workout_name});
			}

			newWorkout= new odb.Workout(opts);
			_log.debug('typeName:', newWorkout.typeName);
			return newWorkout.FindSimilarTypes();}).then(function(docs){
			_log.debug('got similar Types:', docs);

			// Create new Workout
			return odb.core.create(odb.Workout, opts);}).then(() => ({send: {success: true, message: `Workout created with name:${newWorkout.name}`}}));
	}
}

exports.Workout= Workout;








