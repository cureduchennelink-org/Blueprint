#
#	Trip Manager
#

Promise= require 'bluebird'

class TripManager
	@deps: mysql: ['trip'], services: ['tokenMgr']
	constructor: (kit) ->
		@E=			kit.services.error
		@sdb= 		kit.services.db.mysql
		@tokenMgr=	kit.services.tokenMgr

	getTripFromToken: (ctx, token)->
		f= 'TripManager:getTripFromToken'
		trip= false

		Promise.resolve().bind @
		.then ->

			# Get the trip associated with this token
			@sdb.trip.get_by_token ctx, token
		.then (db_rows)->
			return status: 'unknown' if db_rows.length isnt 1
			trip= db_rows[0]

			# Calculate status of the trip
			if trip.void
				trip.status= 'void'
			else if trip.expires isnt null and trip.expires < new Date()
				trip.status= 'expired'
			else if	trip.returned isnt null
				trip.status= 'returned'
			else
				trip.status= 'valid'

			# Return trip w/ status attached to it
			trip

	planTrip: (ctx, auth_ident_id, json_obj, expires, domain)->
		f= 'TripManager:planTrip'
		token= false
		trip= false
		json= JSON.stringify json_obj

		Promise.resolve().bind @
		.then ->

			# Generate New Token from Token Manager
			@tokenMgr.CreateToken 10
		.then (new_token)->
			ctx.log.debug f, 'got new token:', new_token
			token= new_token

			# Create New Badge
			# TODO: Create expires Date Object here?
			@sdb.trip.create ctx, { auth_ident_id, json, expires, domain, token }
		.then (db_result)->
			ctx.log.debug f, 'got new trip result:', db_result
			throw new @E.DbError 'TRIPMANAGER:NEW_TRIP:CREATE' if db_result.affectedRows isnt 1

			# Grab the new Trip that was created
			@sdb.trip.get_by_id ctx, db_result.insertId
		.then (db_rows)->
			throw new @E.NotFoundError 'TRIPMANAGER:NEW_TRIP:REREAD' if db_rows.length isnt 1
			trip= db_rows[0]

			# Return new Trip
			trip

	returnFromTrip: (ctx, trip_id, ident_id)->
		f= 'TripManager:returnFromTrip'
		new_values= returned: new Date()

		Promise.resolve().bind @
		.then ->

			# Update 'returned' timestamp. Update ident_id when supplied
			new_values.ident_id= ident_id if typeof ident_id is 'number'
			@sdb.trip.update_by_id ctx, trip_id, new_values
		.then (db_result)->
			ctx.log.debug f, 'got returned trip result:', db_result
			throw new @E.DbError 'TRIPMANAGER:RETURN:UPDATE' if db_result.affectedRows isnt 1

	voidTrip: (ctx, trip_id)->
		f= 'TripManager:voidTrip'

		Promise.resolve().bind @
		.then ->

			# Update void
			@sdb.trip.update_by_id ctx, trip_id, { void: 1 }
		.then (db_result)->
			ctx.log.debug f, 'got void trip result:', db_result
			throw new @E.DbError 'TRIPMANAGER:VOID:UPDATE' if db_result.affectedRows isnt 1


exports.TripManager= TripManager
