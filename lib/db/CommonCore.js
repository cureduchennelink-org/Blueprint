// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Core DB Functions. Includes DB Pool
//

const Promise = require('bluebird');

class CommonCore {
	static deps() {
		return { services: ['error', 'logger'] };
	}
	constructor(kit, pool_opts) {
		this.StartTransaction = this.StartTransaction.bind(this);
		this.method_factory = this.method_factory.bind(this);
		this.E = kit.services.error;
		const _log2 = pool_opts.level2_debug ? kit.services.logger.log : { debug() { } };
		this.is_db_log_on = pool_opts.level2_debug;
	}


	StartTransaction(ctx) { // Assumes conn on ctx
		const f = 'DB:SqlCore:StartTransaction';

		return Promise.resolve().bind(this)
			.then(function () {

				// Initialize the transaction
				return this.sqlQuery(ctx, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
			}).then(function () {

				// Start the transaction
				return this.sqlQuery(ctx, 'START TRANSACTION');
			}).then(() => null);
	}

	// Factory for attaching common functions to SQL Modules
	// GetCollection (ctx)
	// GetByKey (ctx, key, ids)
	// UpdateByKey (ctx, key, ids, new_values)
	// DisposeByIds (ctx, ids)
	// get_by_id (ctx, id) # TODO: Remove
	// Create (ctx, new_values, re_read)
	// UpdateById (ctx, id, new_values, re_read)
	// DeleteById (ctx, id)
	method_factory(sql_mod, name) {
		if (!sql_mod.table) { throw new this.E.ServerError("DB:CORE:MOD_TABLE", `table undefined for ${name}`); }
		if (!sql_mod.schema) { throw new this.E.ServerError("DB:CORE:MOD_SCHEMA", `schema undefined for ${name}`); }
		const {
			table
		} = sql_mod;
		const {
			ident_tbl
		} = sql_mod;
		const {
			schema
		} = sql_mod;
		const {
			sqlQuery
		} = this;

		if (schema.GetByKey) {
			sql_mod.GetByKey = (ctx, key, ids, lock) => {
				const f = `DB:${name}:GetByKey:`;
				if (this.is_db_log_on) { ctx.log.debug(f, key); }

				return Promise.resolve().bind(this)
					.then(function () {

						if (!schema.GetByKey[key]) { throw new this.E.DbError(`DB:CORE:SCHEMA_UNDEFINED:GetByKey_${key}`); }
						let sql = `\
SELECT ${schema.GetByKey[key].join(',')}
FROM ${table}
WHERE di= 0 AND ${key} IN (?)\
`;
						if (lock) { sql += ' FOR UPDATE'; }
						return sqlQuery(ctx, sql, [ids]);
					})
					.then(db_rows => db_rows);
			};
		}

		if (schema.UpdateByKey) {
			sql_mod.UpdateByKey = (ctx, key, ids, new_values) => {
				let nm, val;
				const f = `DB:${name}:UpdateByKey:`;
				if (this.is_db_log_on) { ctx.log.debug(f, key); }

				if (!schema.UpdateByKey[key]) { throw new this.E.DbError(`DB:CORE:SCHEMA_UNDEFINED:UpdateByKey_${key}`); }
				for (nm in new_values) {
					val = new_values[nm];
					if (!Array.from(schema.UpdateByKey[key]).includes(nm)) {
						throw new this.E.DbError("UPDATE_BY_KEY:COL_NOT_IN_SCHEMA", { col: nm, value: val });
					}
				}

				return Promise.resolve().bind(this)
					.then(function () {

						const cols = []; const arg = [];
						for (nm in new_values) { val = new_values[nm]; cols.push(nm + '= ?'); arg.push(val); }
						arg.push(ids);
						const sql = `\
UPDATE ${table} SET ${cols.join(',')}
WHERE ${key} IN (?) AND di= 0\
`;
						return sqlQuery(ctx, sql, arg);
					}).then(db_result => db_result);
			};
		}

		if (schema.DisposeByIds) {
			sql_mod.DisposeByIds = (ctx, ids) => {
				const f = `DB:${name}:DisposeByIds:`;
				if (this.is_db_log_on) { ctx.log.debug(f, ids); }

				// TODO JCS PERFORMANCE: SINCE sqlQuery ALREADY RETURNS A PROMISE, CONSIDER JUST CALLING IT W/O PROMISE AND TWO .THENS
				return Promise.resolve().bind(this)
					.then(function () {

						const sql = `\
UPDATE ${table} SET di= 1 WHERE id IN (?)\
`;
						return sqlQuery(ctx, sql, [ids]);
					})
					.then(db_result => db_result);
			};
		}

		if (schema.get_collection || schema.GetCollection) {
			const get_collection = ctx => {
				const f = `DB:${name}:get_collection:`;
				if (this.is_db_log_on) { ctx.log.debug(f); }
				const schema_cols = schema.get_collection != null ? schema.get_collection : schema.GetCollection;
				return Promise.resolve().bind(this)
					.then(function () {

						const sql = `\
SELECT ${schema_cols.join(',')}
FROM ${table}
WHERE di= 0\
`;
						return sqlQuery(ctx, sql);
					}).then(db_rows => db_rows);
			};
			sql_mod.get_collection = get_collection; // Deprecated
			sql_mod.GetCollection = get_collection;
		}

		if (schema.get_by_id) { // Deprecated. Use GetByKey with 'id' # TODO: Remove when nothing uses it
			sql_mod.get_by_id = (ctx, id) => {
				const f = `DB:${name}:get_by_id:`;
				if (this.is_db_log_on) { ctx.log.debug(f, id); }

				return Promise.resolve().bind(this)
					.then(function () {

						const sql = `\
SELECT ${schema.get_by_id.join(',')}
FROM ${table}
WHERE id= ? AND di= 0\
`;
						return sqlQuery(ctx, sql, [id]);
					})
					.then(db_rows => db_rows);
			};
		}

		if (schema.create || schema.Create) {
			const create = async (ctx, new_values, reRead, savePoint) => {
				const savePointList= ['first', 'subsequent']
				let nm, val;
				const f = `DB:${name}:create:`;
				if (this.is_db_log_on) { ctx.log.debug(f, new_values, reRead, savePoint); }
				if (savePoint!= null && !savePointList.includes(savePoint))  throw new this.E.ServerError(f + 'SavePoint:'+savePoint)
				const schema_cols = schema.create != null ? schema.create : schema.Create;
				if (reRead === true && !Array.isArray(schema.reread)) {
					throw new this.E.ServerError(f + 'REREAD_NOT_DEFINED_IN_SCHEMA');
				}

				for (nm in new_values) {
					val = new_values[nm];
					if (!Array.from(schema_cols).includes(nm)) {
						throw new this.E.DbError(`DB:CORE:BAD_INSERT_COL-${table}-${nm}`);
					}
				}

				const cols = ['cr']; const qs = ['?']; const arg = [null];
				for (nm in new_values) { val = new_values[nm]; cols.push(nm); qs.push('?'); arg.push(val); }
				const sql = `\
					INSERT INTO ${table}
					(${cols.join(',')}) VALUES (${qs.join(',')})
					${reRead !== true ? '' : 'RETURNING ' + schema.reread}\
				`;
				// Allow try-catch and retry insert on subsequent  calls to Create
				const savePointName= 'common_core_create'
				if (savePoint=== savePointList[0]) { // First time
					await sqlQuery(ctx, `SAVEPOINT ${savePointName}`)
				} else if (savePoint=== savePointList[1]) { // Subsequent inserts
					await sqlQuery(ctx, `ROLLBACK TO SAVEPOINT ${savePointName}`)
				}
				const result= await sqlQuery(ctx, sql, arg);
				if (savePointList.includes( savePoint)) { // On success, remove the savepoint
					await sqlQuery(ctx, ` RELEASE SAVEPOINT ${savePointName}`)
				}
				return result
			}

			sql_mod.create = create; // Deprecated
			sql_mod.Create = create;
		}


		if (schema.update_by_id || schema.UpdateById) {
			const update_by_id = (ctx, id, new_values, re_read) => {
				let nm, val;
				const f = `DB:${name}:update_by_id:`;
				if (this.is_db_log_on) { ctx.log.debug(f, { id, new_values, re_read }); }
				const schema_cols = schema.update_by_id != null ? schema.update_by_id : schema.UpdateById;
				let result = false;

				for (nm in new_values) {
					val = new_values[nm];
					if (!Array.from(schema_cols).includes(nm)) {
						throw new this.E.DbError('Invalid ' + table + ' Update Column', { col: nm, value: val });
					}
				}

				return Promise.resolve().bind(this)
					.then(function () {

						const cols = []; const arg = [];
						for (nm in new_values) { val = new_values[nm]; cols.push(nm + '= ?'); arg.push(val); }
						arg.push(id);
						const sql = `\
UPDATE ${table} SET ${cols.join(',')}
WHERE id= ? AND di= 0\
`;
						return sqlQuery(ctx, sql, arg);
					}).then(function (db_result) {
						result = db_result;

						if (re_read !== true) { return false; }
						if (!schema.reread) { throw new this.E.ServerError(f + 'REREAD_NOT_DEFINED_IN_SCHEMA'); }
						const sql = `\
SELECT ${schema.reread.join(',')}
FROM ${table}
WHERE id= ?\
`;
						return sqlQuery(ctx, sql, [id]);
					})
					.then(function (db_rows) {
						if (db_rows !== false) {
							if (db_rows.length !== 1) { throw new this.E.NotFoundError(f + 'REREAD'); }
							result = db_rows[0];
						}
						return result;
					});
			};
			sql_mod.update_by_id = update_by_id; // Deprecated
			sql_mod.UpdateById = update_by_id;
		}

		if (schema.delete_by_id || schema.DeleteById) {
			const delete_by_id = (ctx, id) => {
				const sql = `\
DELETE FROM ${table}
WHERE id= ?\
`;
				return (sqlQuery(ctx, sql, [id]))
					.then(db_result => db_result);
			};

			sql_mod.delete_by_id = delete_by_id; // Deprecated
			return sql_mod.DeleteById = delete_by_id;
		}
	}
}

exports.CommonCore = CommonCore;
