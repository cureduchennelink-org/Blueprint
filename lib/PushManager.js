//
// Push Service Module
//
//
// pm= kit.service.PushManager
//
// pm.GetPushHandle ctx, route, slice) // In a 'GET' route, return this as send.push_handle (i.e. {c: 99, h: 'User,33'}
//
// pm.Create( ctx, route, slice, {resource, id, new_record})
// pm.Update( ctx, route, slice, {resource, id, old_record, new_record})
// pm.Delete( ctx, route, slice, {resource, id, old_record})

_route_slice= (route, slice)=> String([ route, String( slice)]);
_ctx_wrap= async (caller_f, self, error_cb, cb)=> {
	const f= '(_ctx_wrap)'+ caller_f;

	// Acquire DB Connection
	const conn= await self.sdb.core.Acquire();
	const ctx={ log: self.log, conn, };
	try {
		await cb(ctx)
	} catch (ctx_wrap_e) {
		error_cb( ctx_wrap_e);
	} finally {
		self.sdb.core.release( conn);
	}
}
class PushManager {
	static deps() {
		return {
			services:[ 'error', 'logger', ],
			psql:[ 'push_item', ],
			config: 'push_service[poll_interval,max_buffer_size,poll_limit]',
		};
	}
	constructor( kit) {
		this.E=		kit.services.error;
		this.log=	kit.services.logger.log;
		this.sdb=	kit.services.db.psql;
		this.config=kit.services.config.push_service;

		this.poll_interval=  this.config.poll_interval;

		this.interested_parties= []; // List of callbacks to call when changes are processed
		this.last_item_id= 0;
		this.set_timeout= this.config.set_timeout || setTimeout;
	}

	RegisterForChanges( cb){ return this.interested_parties.push( cb); }

	// Called after all services and routes have been initialized
	async server_start( kit){
		const f= 'PushManager:server_start';
		let db_rows;

		const on_error= (e)=> { throw e;};
		await _ctx_wrap( f, this, on_error, async (ctx)=> {

			// Read as far back as we have room in the buffer for
			db_rows= await this.sdb.push_item.GetMostRecentChanges( ctx, this.config.max_buffer_size);
		});
		if (db_rows.length) {
			this.last_item_id= db_rows[ db_rows.length- 1].id;

			// Update all interested parties w/ most recent changes
			this.interested_parties.forEach( cb=> cb( db_rows) );
		}
		// Start the Poller
		return this._Start();
	}

	_Start(){ return this.timer= this.set_timeout( this._Poll.bind( this), this.poll_interval); }

	async _Poll(){
		const f= 'PushManager:_Poll';
		const limit= this.config.poll_limit;
		let db_rows;

		const on_error= (push_item_GetNext)=> {
			this.log.debug( f, {push_item_GetNext});
			db_rows= [];
		}
		await _ctx_wrap( f, this, on_error, async (ctx)=> {

			// Read all push_item from last cursor
			db_rows= await this.sdb.push_item.GetNext( ctx, this.last_item_id, limit);
		});
		if (db_rows.length) {
			// Update our high-water-mark counter
			this.last_item_id= db_rows[db_rows.length - 1].id;
			// Propagate changes
			this.interested_parties.forEach( cb=> cb( db_rows) );
		}

		// Restart the timer
		this.timer= this.set_timeout( this._Poll.bind( this), this.poll_interval);
		return this.timer
	}

	async CleanRoute( ctx, route){
		const f= 'PushManager:CleanPushRoute';
		ctx.log.debug( f, {route});

		// Remove all items in this route
		await this.sdb.push_item.delete_by_route( ctx, _route_slice( route, ''));

		return true;
	}

	async GetPushHandle( ctx, route, slice) {
		const f= `PushRoute:GetPushHandle:`;
		ctx.log.debug( f, {route, slice});
		let db_rows;

		const route_slice= _route_slice( route, slice);
		db_rows= await this.sdb.push_item.GetMostRecentCount( ctx, route_slice);
		const item_rec= db_rows.length? db_rows[ 0]: {id:0};

		return {c: item_rec.id, h: route_slice};
	}

	async Create( ctx, route, slice, payload) {
		return this.MakeItem( ctx, route, slice,{ verb: 'create', ...payload, });
	}

	async Delete( ctx, route, slice, payload) {
		return this.MakeItem( ctx, route, slice,{ verb: 'delete', ...payload, });
	}

	async Update( ctx, route, slice, payload) {
		return this.MakeItem( ctx, route, slice,{ verb: 'update', ...payload, });
	}

	async MakeItem( ctx, route, slice, payload) {
		const f= `PushRoute:MakeItem:`;
		ctx.log.debug(f, { route, slice, payload });
		const route_slice= _route_slice( route, slice);
		let db_rows, new_values;

		// Insert the change
		new_values= { route_slice, payload, };
		db_rows= await this.sdb.push_item.create( ctx, new_values); // returns e.g. [{id:99}]
		if( db_rows.length!== 1) throw new this.E.DbError( f+ 'create:'+ db_rows.length);
		return true;
	}

}

exports.PushManager= PushManager;
