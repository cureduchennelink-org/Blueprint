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


		// TODO: Can we leverage pool events to do anything?
		// this.pool.on("connect", (client) => {
		// 	console.log('acquired!');
		// })

		this.pool.on("error", (err, client) => {
			console.log('POOL ERROR :>> ', err);
		})

		// this.pool.on('remove', () => {
		// 	console.log('removed!');
		// })


		this.acquire= function(callback){ return this.pool.connect(callback); };
		this.Acquire= Promise.promisify(this.acquire, {context: this});
	}

	//	CRB: args must be an array because there are many commands we make that don't use arguments
	// 	CommonCore.js 29:9 sets the transaction level as serializable and doesn't use an argument
	async sqlQuery(ctx, sql, args = []) {
		const f = `${this.f}:sqlQuery::`;
		if (!args || !Array.isArray(args)) throw new this.E.InvalidArg(`${f} ARGS MUST BE AN ARRAY, IT IS ${typeof args}`)
		if (ctx.conn === null) throw new this.E.DbError(`${f} CONNECTION NOT FOUND.`)

		const statement = this._getStatement(sql, args)

		this._log(ctx, `${f} SQL :>> ${statement}`)
		this._log(ctx, `${f} ARGUMENTS :>> ${args}`)
		const result = await ctx.conn.query(statement, args);

		if (result.command === "UPDATE") {
			this._log(ctx, `${f} RESULT :>> ${result.rowCount}`)
			
			// 06/26/20
			// CRB: When using postgres, you have the option to include a 
			// RETURNING clause, returning the information you requested about the 
			// records that were involved in the update.
			// Doing so returns that data in a `rows` property.
			
			return result.rows.length ? result.rows : result.rowCount;
		}

		this._log(ctx, `${f} RESULT :>> ${result.rows}`)
		return result.rows;
	};

	release(conn) {
		return conn.release(true)
	}

	destroy(conn) {
		return conn.end()
	}

	async closePool() {
		await this.pool.end()
		this._log({}, 'POOL CLOSED.');
	}

	_log(ctx = {}, message) {
		if (!this.is_db_log_on || ctx.silent) return;
		this.logger.debug(message);
	}

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
PostgreSqlCore.initClass();


exports.PostgreSqlCore= PostgreSqlCore;
