/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Core DB Functions. Includes DB Pool
//

const Promise=	require('bluebird');
const { Pool, Client }= require('pg');
const {CommonCore}= require('../CommonCore');


class PostgreSqlCore extends CommonCore {
	static initClass() {
		this.deps= {services: ['error','logger']};
	}
	constructor(kit, pool_opts){
		{
		  // Hack: trick Babel/TypeScript into allowing this before super.
		  if (false) { super(); }
		  let thisFn = (() => { return this; }).toString();
		  let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
		  eval(`${thisName} = this;`);
		}
		this.f = 'PostgreSqlCore';
		this.E= kit.services.error;
		const _log2= pool_opts.level2_debug ? kit.services.logger.log : {debug() {}};
		this.is_db_log_on= pool_opts.level2_debug;
		this.pool= new Pool(pool_opts);
		this.acquire= function(callback){ return this.pool.connect(callback); };
		this.Acquire= Promise.promisify(this.acquire, {context: this});
		this.release= function(conn){
			_log2.debug('DB:PostgreSqlCore:release:', 'releasing conn');
			return conn.release();
		};
		this.destroy= function(conn){
			_log2.debug('DB:PostgreSqlCore:destroy:', 'destroying conn');
			return conn.end();
		};

		//		CRB: args must be an array because there are many commands we make that don't use arguments
		// 	CommonCore.js 29:9 sets the transaction level as serializable and doesn't use an argument
		this.sqlQuery= (ctx, sql, args)=> {
			if (args == null) { args = []; }
			const f = `${this.f}:sqlQuery::`;
			if (this.is_db_log_on) { ctx.log.debug('DB:PostgreSqlCore:sqlQuery:', sql); }
			if (args && this.is_db_log_on) { ctx.log.debug('DB:PostgreSqlCore:args:', args); }
			if (args && !Array.isArray(args)) { throw new this.E.InvalidArg(f + "args must be an array!"); }
			if (ctx.conn === null) { throw new this.E.DbError('DB:PostgreSQL:BAD_CONN'); }
			let statement = sql;
			const query= Promise.promisify(ctx.conn.query, {context: ctx.conn});
			return Promise.resolve().bind(this)
			.then(function() {
				for (let index = 0; index < args.length; index++) {
					const value = args[index];
					if (Array.isArray(value)) {
						statement.replace('IN (?)', '= ANY($'+(index+1)+')');
					} else {
						statement = statement.replace('?', '$'+(index+1));
					}
				}

				return query(statement, args);}).then(function(just_rows){
				if (this.is_db_log_on) { ctx.log.debug('DB:PostgreSqlCore:result:', just_rows); }
				return just_rows.rows;
			});
		};
	}
}
PostgreSqlCore.initClass();


exports.PostgreSqlCore= PostgreSqlCore;