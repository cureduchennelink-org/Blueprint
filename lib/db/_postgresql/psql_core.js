const Promise=	require('bluebird');
const { Pool }= require('pg');
const { CommonCore }= require('../CommonCore');

class PostgreSqlCore extends CommonCore {
	static initClass() {
		this.deps= {services: ['error','logger']};
	}
	constructor(kit, pool_opts){
		super(kit, pool_opts)
		// CRB: This is absolutely necessary until we get rid of the promise.resolve().bind(this)
		this.sqlQuery = this.sqlQuery.bind(this)
		this.logger = kit.services.logger.log
		this.f = 'PostgreSqlCore';
		this.E= kit.services.error;
		this.pool= new Pool(pool_opts)
		this.pool_id= 100; // 3 digits everywhere

		// This can fire on connections idle in the pool, when e.g. the DB goes down or is unavailable
		this.pool.on("error", (err, client) => {
			// Using logger so we can trace this back to a process/host/date/time and .error to look for it in the error logs
			this.logger.error( this.f, err);
		})

		this.acquire= function(callback){ return this.pool.connect(callback); };
		// Don't use promisify because psql already has Promise version
		this.Acquire=( async function(){
			const result= await this.pool.connect(); // TODO AWAIT MIGHT NOT FLY HERE
			if (result.__pool_id == null) {result.__pool_id = this.pool_id++;}
			return result
		}).bind( this);
	}
	// Look for DB issues (similar to _fatalError for MySQL
	// Maybe can use ._connected (and/or _connectionError), also {_queryable, readyForQuery: true,} could be checked before trying to attempt another query
	_checkConn( conn, forQuery= false){
		if (conn== null) return 'NOT FOUND';
		if (conn._connected!== true || conn._connectionError!== false) return _.pick( conn, [ '_connected', '_connectionError', '__pool_id']);
		if (forQuery=== true) {
			if (conn._queryable!== true || conn.readyForQuery!== true) return _.pick( conn, [ '_queryable', 'readyForQuery', '__pool_id']);
		}
		return true;
	}

	//	CRB: args must be an array because there are many commands we make that don't use arguments
	// 	CommonCore.js 29:9 sets the transaction level as serializable and doesn't use an argument
	async sqlQuery(ctx, sql, args = [], pure_psql) {
		if (!args || !Array.isArray(args)) throw new Error(`${this.f} ARGS MUST BE AN ARRAY, IT IS ${typeof args}`)
		const isConnOk= this._checkConn( ctx.conn, true);
		if (isConnOk!== true) throw new Error( `${this.f} CONNECTION BAD (${JSON.stringify( isConnOk)})`);
		const f= `${this.f}:sqlQuery:-${ctx.conn.__pool_id}-:`;

		const statement = pure_psql=== true? sql: this._getStatement(sql, args);
		this._log(ctx, f+ 'PSQL:'+ args.length, statement);
		if( args.length){ this._log(ctx, f+ 'ARGS', args);}
		const start_time= Date.now();
		const result = await ctx.conn.query(statement, args);

		// Note: Returning early here, won't allow us to track time_ms on these calls. Could have been important in some cases.
		if (result.command=== 'SET' || result.command=== 'START' || result.command=== 'COMMIT' || result.command=== 'ROLLBACK'){ return result; }
		const pick= ({command, rowCount, rows})=>( {command, rowCount, rows: rows.slice( 0, 2)});
		const log_result= pick( result);
		//this._log(ctx, f, {log_result, time_ms: Date.now()- start_time});
		log_result.time_ms= Date.now()- start_time;
		this._log(ctx, f, log_result);
		if (result.command !== "SELECT") {
			
			// 06/26/20
			// CRB: When using postgres, you have the option to include a 
			// RETURNING clause, returning the information you requested about the 
			// records that were involved in the update.
			// Doing so returns that data in a `rows` property.
			
			return result.rows.length ? result.rows : {affectedRows: result.rowCount};
		}
		return result.rows;
	};

	release(conn) {
		return conn.release();
	}

	destroy(conn) {
		return conn.relase( true);
	}

	// From the docs:
	// Calling pool.end will drain the pool of all active clients, disconnect them, and shut down any internal timers in the pool.
	// It is common to call this at the end of a script using the pool or when your process is attempting to shut down cleanly
	async closePool() {
		const f= this.f+ ':closePool:';
		await this.pool.end()
		this._log({}, f, 'POOL CLOSED.');
	}

	_log(ctx = {}, f, data) {
		if (!this.is_db_log_on || ctx.silent) return;
		if (ctx.log) {
			ctx.log.debug( f, data);
		} else {
			this.logger.debug(f, data);
		}
	}

	// Note: Does not play well with UNNEST or other args which take an actual array
	_getStatement(statement, args) {
		let _statement = statement;
		for (let index = 0; index < args.length; index++) {
			const value = args[index];
			if (Array.isArray(value)) {
				_statement = _statement.replace('IN (?)', '= ANY($'+(index+1)+')');
			} else {
				_statement = _statement.replace('?', '$'+(index+1));
			}
		}

		return _statement
	}
}


exports.PostgreSqlCore= PostgreSqlCore;

// PostgreSQL API info
// See : https://node-postgres.com/api/pool
// Pool-config:
//
//  (First, include options from Client object)
//  user?: string, // default process.env.PGUSER || process.env.USER
//  password?: string, //default process.env.PGPASSWORD
//  host?: string, // default process.env.PGHOST
//  database?: string, // default process.env.PGDATABASE || process.env.USER
//  port?: number, // default process.env.PGPORT
//  connectionString?: string, // e.g. postgres://user:password@host:5432/database
//  ssl?: any, // passed directly to node.TLSSocket, supports all tls.connect options
//  types?: any, // custom type parsers
//  statement_timeout?: number, // number of milliseconds before a statement in query will time out, default is no timeout
//  query_timeout?: number, // number of milliseconds before a query call will timeout, default is no timeout
//  connectionTimeoutMillis?: number, // number of milliseconds to wait for connection, default is no timeout
//  / number of milliseconds to wait before timing out when connecting a new client
//  // by default this is 0 which means no timeout
//
//  (Next, include options specific to Pool)
//  connectionTimeoutMillis?: int,
//  // number of milliseconds a client must sit idle in the pool and not be checked out
//  // before it is disconnected from the backend and discarded
//  // default is 10000 (10 seconds) - set to 0 to disable auto-disconnection of idle clients
//  idleTimeoutMillis?: int,
//  // maximum number of clients the pool should contain
//  // by default this is set to 10.
//  max?: int,

// To release and still use a connecxtion use .release(), to destroy .release( true)

// Notes:
// Named queries allow for 'prepair' which could speed things up significantly (look at perf info on a production system)
// pool object has some great stats attributes we might add to logging (i.e. number waiting on connections)
// Pool has on('error') which might happen to connections that are idle if e.g. the server goes down
// Pool's config.max default is 10, so we need to always set that explicitly (i.e. to 60)
//  (Additional not on config.max - we may find a number 1/4th the size of mysql is more performant. Need to size actual connections at the DB side.)

