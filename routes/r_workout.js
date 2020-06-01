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
const Promise= require('blueprint');

class Workout {
	constructor(kit){
		this._get = this._get.bind(this);
		this._create = this._create.bind(this);
		kit.services.logger.log.info('Initializing Workout Routes...');
		this.E= kit.services.error;
		this.odb= kit.services.db.mongo;

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
		const f= 'Workout:_get:';
		const {
            p
        } = ctx;

		ctx.log.debug(f, p);

		return Promise.resolve().bind(this)
		.then(function() {

			return this.odb.core.find(this.odb.Workout, {});})
		.then(docs => ({
            send: {workouts: docs}
        }));
	}

	_create(ctx, pre_loaded){
		const use_docs= {description: 'rS', workout_name: 'rS', type: 'rE:good,bad'};
		if (ctx === 'use') { return use_docs; }
		const f= 'Workout:_create:';
		const {
            p
        } = ctx;

		let newWorkout= false;
		const opts= {name: p.workout_name, description: p.description, type: p.type};

		if (!p.description) { throw new this.E.MissingArg('description'); }
		if (!p.workout_name) { throw new this.E.MissingArg('workout_name'); }
		if (!p.type) { throw new this.E.MissingArg('type'); }

		return Promise.resolve().bind(this)
		.then(function() {

			// Search for an Existing Workout
			return this.odb.Workout.FindByName(p.workout_name);}).then(function(docs){
			ctx.log.debug('got docs:', docs);
			if (docs.length > 0) {
				throw new this.E.AccessDenied('Name already exists', {name: p.workout_name});
			}

			newWorkout= new this.odb.Workout(opts);
			ctx.log.debug('typeName:', newWorkout.typeName);
			return newWorkout.FindSimilarTypes();}).then(function(docs){
			ctx.log.debug('got similar Types:', docs);

			// Create new Workout
			return this.odb.core.create(this.odb.Workout, opts);}).then(() => ({
            send: {success: true, message: 'Workout created with name:' + newWorkout.name}
        }));
	}
}

exports.Workout= Workout;
