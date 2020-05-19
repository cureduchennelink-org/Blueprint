const Promise=	require('bluebird');
const { Pool }= require('pg');
const { CommonCore }= require('../CommonCore');

class PostgreSqlCore extends CommonCore {
	static initClass() {
		this.deps= {services: ['error','logger']};
	}
	constructor(kit, pool_opts){
		super(kit, pool_opts)
		this.logger = kit.services.logger.log
		this.f = 'PostgreSqlCore';
		this.E= kit.services.error;
		this.pool= new Pool(pool_opts);
		this.acquire= function(callback){ return this.pool.connect(callback); };
		this.Acquire= Promise.promisify(this.acquire, {context: this});
	}

	//	CRB: args must be an array because there are many commands we make that don't use arguments
	// 	CommonCore.js 29:9 sets the transaction level as serializable and doesn't use an argument
	async sqlQuery(ctx, sql, args = []) {
		const f = `${this.f}:sqlQuery::`;
		if (args && !Array.isArray(args)) throw new this.E.InvalidArg(`${f} ARGS MUST BE AN ARRAY, IT IS ${typeof args}`)
		if (ctx.conn === null) throw new this.E.DbError(`${f} BAD CONNECTION`)

		this._log(ctx, `${f} SQL :>> ${sql}`)
		this._log(ctx, `${f} ARGUMENTS :>> ${args}`)

		const statement = this._getStatement(sql, args)
		const query= Promise.promisify(ctx.conn.query, {context: ctx.conn});
		const result = await query(statement, args);

		this._log(ctx, `${f} RESULT :>> ${result.rows}`)

		if (result.command === "UPDATE") return result.rowCount;
		return result.rows;
	};

	release(conn) {
		const f = `${this.f}:release::`
		this._log({}, f)
		return conn.release()
	}

	destroy(conn) {
		const f = `${this.f}:destroy::`
		this._log({}, f)
		return conn.end()
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
				_statement.replace('IN (?)', '= ANY($'+(index+1)+')');
			} else {
				_statement = _statement.replace('?', '$'+(index+1));
			}
		}

		return _statement
	}
}
PostgreSqlCore.initClass();


exports.PostgreSqlCore= PostgreSqlCore;