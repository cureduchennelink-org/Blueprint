//
// Lamd: "Logging, Auditing, Monitoring and Debugging" Service using PostgreSQL
//
// Uses: kit.services.config.plamd: DB settings and timings for flushes and connection pool refresh
//
// Notes:
//
//  Method: write
//   Caller (typically a wrapper) should protect itself from errors that may occur
//   'data' should include _id if caller wants objects serialized to timestamps based on when endpoint was first called vs. when eventually written
//   Attempting delayed write to avoid latency on REST responses
//
//  Method: server_init
//
//  Future:
//   Can hook into server middleware to log inbound requests even when no endpoint matchd(like hacks or broken clients)
//   Add server up/down events into stream (will need to add 'down' logic to blueprint, that gives services time to end things?)

class PLamd {
	static deps() {
		return { psql: ['lamd', ], services:[ 'logger', ], config: 'plamd{poll_ms,conn_age_secs,to_debug}'};
	}
	constructor( kit){
		const f= 'PLamd:constructor';
		this.config= kit.services.config.plamd;
		this.log= kit.services.logger.log;
		this.sdb= kit.services.db.psql;

		this.silent= !this.config.loud; // Log our logging sql?
		this.busy= false; // Mutex on doing DB things with a shared handle
		this.conn= false; // Start without one
		this.conn_created= false; // Recycle 'old' handles
		this.conn_age_ms= this.config.conn_age_secs* 1000;

		// Defer writes to keep endpoints fast (also can use our own conn)
		this.data_queue= [];
		this.deep_queue= [];
	}

	// Used by wrapper to install ctx.log for deep logging by business logic
	// Captures log lines into an array until the wrapper calls us to write it all once (write_deep)
	GetLog(ctx){
		ctx.lamd_logger= {debug: []};
		const lamd_logger= {};
		for (let method of [ 'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'child', ]) {
			(method=> {
				return lamd_logger[ method]= (f, data)=> this._log(ctx, method, f, data);
			})(method);
		}
		return lamd_logger;
	}

	_log(ctx, method, f, data){
		if (this.config.to_debug) { this.log.debug(f+( method !== 'debug' ? method : ''), data); }
		if (method === 'child') { return; }
		return ctx.lamd_logger.debug.push({method, f, data});
	}

	// DB is now available, get a DB handle before endpoints consume them; refresh this handle periodically
	// Start background process to flush data to the DB
	async server_init( kit){
		const f= 'PLamd:server_init';

		setInterval( this._flush.bind( this), this.config.conn_age_secs* 250); // Periodically check age of connection
		await this._flush_raw() // Call now, don't wait for timer, don't catch errors, so start-up failes if DB cannot connect
	}
	// Background task, so log errors locally, and keep trying to work
	// TODO FIGURE OUT HOW THINGS FAIL WHEN THE DB SERVER IS DOWN, OR DB POOL IS FAILING
	async _flush(){
		const f= 'PLamd:_flush';
		//console.log(f);
		try {
			await this._flush_raw()
			this._schedule();
		} catch (err) {
			return this.log.warn(f + 'err', err);
			this._schedule( 1000);
		}
	}
	// Anytime you DO work or HAVE work, use this to schedule it to run next
	_schedule( next_ms= 0){
		if ( this.busy) return;
		if (this.data_queue.length || this.deep_queue.length) setTimeout( this._flush.bind( this), next_ms);
	}

	async _flush_raw( recurse= false){ // Recursion guard
		const f= 'PLamd:_flush_raw';
		//console.log(f,{recurse_busy_conn_age_data_deep:[recurse,this.busy,this.conn!== false,Date.now()- (this.conn?this.conn_created:Date.now()),this.data_queue.length,this.deep_queue.length]});

		// Ensure we have a DB handle
		if ( this.busy) return;
		if ( this.conn=== false){
			this.busy= true;
			this.conn= await this.sdb.core.Acquire();
			this.conn_created= Date.now();
			this.busy= false;
		}

		// Flush any high-level data
		if ( this.busy) return;
		if ( this.data_queue.length){
			this.busy= true;
			const data_queue= this.data_queue;
			this.data_queue= []; // Allow this.write to proceed while we flush current queue
			var result= false;
			try {
				result= await this.sdb.lamd.write_many({ silent: this.silent, conn: this.conn}, data_queue);
			} catch (err) {
				// TODO CONSIDER HOW TO LOG LINES ON DB WRITE FAILURES (BUT NOT IF TO_DEBUG WAS SET)
				this.log.warn( f+ 'data', { err});
			} finally {
				this.busy= false;
			}
			//console.log( f, result); // TODO CHECK RESULT?
		}

		// Flush any lower-level data
		if ( this.busy) return;
		if ( this.deep_queue.length){
			this.busy= true;
			// Only write one item, because it can be quite large (all debug lines for the whole endpoint request)
			const deep_queue_item= this.deep_queue.shift() ;
			var result= false;
			try {
				result= await this.sdb.lamd.write_deep({ silent: this.silent, conn: this.conn}, deep_queue_item);
			} catch (err) {
				// TODO CONSIDER HOW TO LOG LINES ON DB WRITE FAILURES (BUT NOT IF TO_DEBUG WAS SET)
				this.log.warn( f+ 'deep', { err});
			} finally {
				this.busy= false;
			}
			//console.log( f, result); // TODO CHECK RESULT?
		}

		// TODO IF THE CONNECTION IS BAD, WE KEEP THROWING ERRORS ABOVE SO NEVER GET TO THIS CODE TO REFRESH OUR CONNECTION
		// Recyle 'old' handles
		if ( recurse || this.conn=== false || this.busy) return; // Being cautious
		if ( Date.now()- this.conn_created > this.conn_age_ms){
			// Return aged connection back to pool, get a new one
			this.sdb.core.release( this.conn);
			this.conn= false;
			this._flush_raw( true); // Call now, don't wait for timer, indicate recursion
		}
	}
	
	// Called typically from inside a 'wrapper', so errors could either cause havac or be silently discarded
	// Handles top most level event (i.e. one call per endpoint request)
	write( data){
		const f= 'PLamd:write:';
		if (this.config.to_debug) { this.log.debug(f, data); }
		this.data_queue.push( data);
		this._schedule();
	}

	// Called typically from inside a 'wrapper', so errors could either cause havac or be silently discarded
	// Handles lowest level event (i.e. one line in array per debug line, but called here once by wrapper at end of request)
	write_deep( ctx){
		const f= 'PLamd:write_deep:';
		this.deep_queue.push( {req_uuid: ctx.lamd.req_uuid, lamd: ctx.lamd, debug: ctx.lamd_logger.debug});
		this._schedule();
	}
}

exports.PLamd= PLamd;


