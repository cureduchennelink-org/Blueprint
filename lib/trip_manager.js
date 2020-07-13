// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Trip Manager
//

const Promise= require('bluebird');

class TripManager {
	static deps() {
		return {mysql: ['trip'], services: ['tokenMgr']};
	}
	constructor(kit) {
		this.E=			kit.services.error;
		this.sdb= 		kit.services.db.psql;
		this.tokenMgr=	kit.services.tokenMgr;
	}

	getTripFromToken(ctx, token){
		const f= 'TripManager:getTripFromToken';
		let trip= false;

		return Promise.resolve().bind(this)
		.then(function() {

			// Get the trip associated with this token
			return this.sdb.trip.get_by_token(ctx, token);}).then(function(db_rows){
			if (db_rows.length !== 1) { return {status: 'unknown'}; }
			trip= db_rows[0];

			// Calculate status of the trip
			if (trip.void) {
				trip.status= 'void';
			} else if ((trip.expires !== null) && (trip.expires < new Date())) {
				trip.status= 'expired';
			} else if	(trip.returned !== null) {
				trip.status= 'returned';
			} else {
				trip.status= 'valid';
			}

			// Return trip w/ status attached to it
			return trip;
		});
	}

	planTrip(ctx, auth_ident_id, json_obj, expires, domain){
		const f= 'TripManager:planTrip';
		let token= false;
		let trip= false;
		const json= JSON.stringify(json_obj);

		return Promise.resolve().bind(this)
		.then(function() {

			// Generate New Token from Token Manager
			return this.tokenMgr.CreateToken(10);}).then(function(new_token){
			ctx.log.debug(f, 'got new token:', new_token);
			token= new_token;

			// Create New Badge
			// TODO: Create expires Date Object here?
			return this.sdb.trip.create(ctx, { auth_ident_id, json, expires, domain, token });})
		.then(function(db_result){
			ctx.log.debug(f, 'got new trip result:', db_result);
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('TRIPMANAGER:NEW_TRIP:CREATE'); }

			// Grab the new Trip that was created
			return this.sdb.trip.get_by_id(ctx, db_result.insertId);}).then(function(db_rows){
			if (db_rows.length !== 1) { throw new this.E.NotFoundError('TRIPMANAGER:NEW_TRIP:REREAD'); }
			trip= db_rows[0];

			// Return new Trip
			return trip;
		});
	}

	returnFromTrip(ctx, trip_id, ident_id){
		const f= 'TripManager:returnFromTrip';
		const new_values= {returned: new Date()};

		return Promise.resolve().bind(this)
		.then(function() {

			// Update 'returned' timestamp. Update ident_id when supplied
			if (typeof ident_id === 'number') { new_values.ident_id= ident_id; }
			return this.sdb.trip.update_by_id(ctx, trip_id, new_values);}).then(function(db_result){
			ctx.log.debug(f, 'got returned trip result:', db_result);
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('TRIPMANAGER:RETURN:UPDATE'); }
		});
	}

	voidTrip(ctx, trip_id){
		const f= 'TripManager:voidTrip';

		return Promise.resolve().bind(this)
		.then(function() {

			// Update void
			return this.sdb.trip.update_by_id(ctx, trip_id, { void: 1 });})
		.then(function(db_result){
			ctx.log.debug(f, 'got void trip result:', db_result);
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('TRIPMANAGER:VOID:UPDATE'); }
		});
	}
}


exports.TripManager= TripManager;
