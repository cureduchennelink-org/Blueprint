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

const Q= 		require('q');
const E= 		require('../../error');
const mysql= 	require('mysql');

let _log= false;
let _log2= {debug(){}};

class SqlCore {
	constructor(pool_opts, log){
		this.StartTransaction = this.StartTransaction.bind(this);
		this.method_factory = this.method_factory.bind(this);
		_log= log;
		if (pool_opts.level2_debug) { _log2= log; }
		this.pool= mysql.createPool(pool_opts);
		this.acquire= function(callback){ return this.pool.getConnection(callback); };
		this.Acquire= Q.nbind(this.acquire, this);
		this.release= function(conn){
			_log2.debug('DB:SqlCore:release:', 'releasing conn');
			return conn.release();
		};
		this.destroy= function(conn){
			_log2.debug('DB:SqlCore:destroy:', 'destroying conn');
			return conn.destroy;
		};

		this.sqlQuery= function(ctx, sql, args){
			_log2.debug('DB:SqlCore:sqlQuery:', sql);
			if (args) { _log2.debug('DB:SqlCore:args:', args); }
			if (ctx.conn === null) { throw new E.DbError('DB:SQL:BAD_CONN'); }
			return (Q.ninvoke(ctx.conn, 'query', sql, args))
			.then(function(rows_n_cols) {
				_log2.debug('DB:SqlCore:result:', rows_n_cols[0]);
				return rows_n_cols[0];});
		};
	}

	StartTransaction(ctx){ // Assumes conn on ctx
		const f= 'DB:SqlCore:StartTransaction';

		return Q.resolve()
		.then(() => {

			// Initialize the transaction
			return this.sqlQuery(ctx, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
	}).then(db_result=> {

			// Start the transaction
			return this.sqlQuery(ctx, 'START TRANSACTION');
		}).then(db_result => null);
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
	method_factory(sql_mod, name){
		if (!sql_mod.table) { throw new E.ServerError("DB:CORE:MOD_TABLE", `table undefined for ${name}`); }
		if (!sql_mod.schema) { throw new E.ServerError("DB:CORE:MOD_SCHEMA", `schema undefined for ${name}`); }
		const { table }= 		sql_mod;
		const { ident_tbl }=  sql_mod;
		const { schema }= 	sql_mod;
		const { sqlQuery }= this;

		if (schema.GetByKey) {
			sql_mod.GetByKey= function(ctx, key, ids){
				const f= `DB:${name}:GetByKey:`;
				ctx.log.debug(f, key);

				return Q.resolve()
				.then(() => {

					if (!schema.GetByKey[key]) { throw new E.DbError(`DB:CORE:SCHEMA_UNDEFINED:GetByKey_${key}`); }
					const sql= `SELECT ${schema.GetByKey[key].join(',')} FROM ${table}`+
						' WHERE di= 0 AND '+ key+ ' IN (?)';
					return sqlQuery(ctx, sql, [ ids]);
			})
				.then(db_rows=> db_rows);
			};
		}

		if (schema.UpdateByKey) {
			sql_mod.UpdateByKey= function(ctx, key, ids, new_values){
				let nm, val;
				const f= `DB:${name}:UpdateByKey:`;
				ctx.log.debug(f, key);

				if (!schema.UpdateByKey[key]) { throw new E.DbError(`DB:CORE:SCHEMA_UNDEFINED:UpdateByKey_${key}`); }
				for (nm in new_values) {
					val = new_values[nm];
					if (!Array.from(schema.UpdateByKey[key]).includes(nm)) {
						throw new E.DbError("UPDATE_BY_KEY:COL_NOT_IN_SCHEMA", { col: nm, value: val});
					}
				}

				return Q.resolve()
				.then(()=> {

					const cols= []; const arg=[];
					for (nm in new_values) { val = new_values[nm]; cols.push(nm + '= ?'); arg.push(val); }
					arg.push(ids);
					const sql= `UPDATE ${table} SET ${cols.join(',')}`+
						' WHERE '+ key+ ' IN (?) AND di= 0';
					return sqlQuery(ctx, sql, arg);
			}).then(db_result=> {
					return db_result;
				});
			};
		}

		if (schema.DisposeByIds) {
			sql_mod.DisposeByIds= function(ctx, ids){
				const f= `DB:${name}:DisposeByIds:`;
				ctx.log.debug(f, ids);

				return Q.resolve()
				.then(() => {

					const sql= `UPDATE ${table} SET di= 1 WHERE id IN (?)`;
					return sqlQuery(ctx, sql, [ ids]);
			})
				.then(db_result=> {
					return db_result;
				});
			};
		}

		if (schema.get_collection || schema.GetCollection) {
			const get_collection= function(ctx){
				const f= `DB:${name}:get_collection:`;
				const schema_cols= schema.get_collection != null ? schema.get_collection : schema.GetCollection;

				return Q.resolve()
				.then(() => {

					const sql= `SELECT ${schema_cols.join(',')} FROM ${table}`+
						' WHERE di= 0';
					return sqlQuery(ctx, sql);
			}).then(db_rows=> db_rows);
			};
			sql_mod.get_collection= get_collection; // Deprecated
			sql_mod.GetCollection= get_collection;
		}

		if (schema.get_by_id) { // Deprecated. Use GetByKey with 'id' # TODO: Remove when nothing uses it
			sql_mod.get_by_id= function(ctx, id){
				const f= `DB:${name}:get_by_id:`;

				return Q.resolve()
				.then(() => {

					const sql= `SELECT ${schema.get_by_id.join(',')} FROM ${table} WHERE id= ? AND di= 0`;
					return sqlQuery(ctx, sql, [id]);
			})
				.then(db_rows=> db_rows);
			};
		}

		if (schema.create || schema.Create) {
			const create= function(ctx, new_values, re_read){
				let nm, val;
				const f= `DB:${name}:create:`;
				_log2.debug(f, new_values);
				const schema_cols= schema.create != null ? schema.create : schema.Create;
				let result= false;

				for (nm in new_values) {
					val = new_values[nm];
					if (!Array.from(schema_cols).includes(nm)) {
						throw new E.DbError(`DB:CORE:BAD_INSERT_COL_${table}_${nm}`);
					}
				}

				return Q.resolve()
				.then(()=> {

					const cols= ['cr']; const qs= ['?']; const arg= [null];
					for (nm in new_values) { val = new_values[nm]; cols.push(nm); qs.push('?'); arg.push(val); }
					const sql= `INSERT INTO ${table} (${cols.join(',')}) VALUES (${qs.join(',')})`;
					return sqlQuery(ctx, sql, arg);
			}).then(db_result=> {
					result= db_result;
					if (db_result.affectedRows !== 1) { throw new E.DbError(f+'NO_INSERT'); }

					if (re_read !== true) { return false; }
					if (!schema.reread) { throw new E.ServerError(f+'REREAD_NOT_DEFINED_IN_SCHEMA'); }
					const sql= `SELECT ${schema.reread.join(',')} FROM ${table} WHERE id= ? AND di= 0`;
					return sqlQuery(ctx, sql, [db_result.insertId]);
				})
				.then(function(db_rows){
					if (db_rows !== false) {
						if (db_rows.length !== 1) { throw new E.NotFoundError(f+'REREAD'); }
						result= db_rows[0];
					}
					return result;
				});
			};
			sql_mod.create= create; // Deprecated
			sql_mod.Create= create;
		}

		if (schema.update_by_id || schema.UpdateById) {
			const update_by_id= function(ctx, id, new_values, re_read){
				let nm, val;
				const f= `DB:${name}:update_by_id:`;
				_log2.debug(f, { id, new_values, re_read });
				const schema_cols= schema.update_by_id != null ? schema.update_by_id : schema.UpdateById;
				let result= false;

				for (nm in new_values) {
					val = new_values[nm];
					if (!Array.from(schema_cols).includes(nm)) {
						throw new E.DbError(`Invalid ${table} Update Column`, {col: nm, value: val});
					}
				}

				return Q.resolve()
				.then(() => {

					const cols= []; const arg=[];
					for (nm in new_values) { val = new_values[nm]; cols.push(nm + '= ?'); arg.push(val); }
					arg.push(id);
					const sql= `UPDATE ${table} SET ${cols.join(',')}` +
						' WHERE id= ? AND di= 0';
					return sqlQuery(ctx, sql, arg);
			}).then(db_result=> {
					result= db_result;

					if (re_read !== true) { return false; }
					if (!schema.reread) { throw new E.ServerError(f+'REREAD_NOT_DEFINED_IN_SCHEMA'); }
					const sql= `SELECT ${schema.reread.join(',')} FROM ${table} WHERE id= ? AND di= 0`;
					return sqlQuery(ctx, sql, [id]);
				})
				.then(function(db_rows){
					if (db_rows !== false) {
						if (db_rows.length !== 1) { throw new E.NotFoundError(f+'REREAD'); }
						result= db_rows[0];
					}
					return result;
				});
			};
			sql_mod.update_by_id= update_by_id; // Deprecated
			sql_mod.UpdateById= update_by_id;
		}

		if (schema.delete_by_id || schema.DeleteById) {
			const delete_by_id= function(ctx, id){
				const sql= `DELETE FROM ${table} WHERE id= ?`;
				return (sqlQuery(ctx, sql, [ id ]))
				.then(db_result=> db_result);
			};

			sql_mod.delete_by_id= delete_by_id; // Deprecated
			return sql_mod.DeleteById= delete_by_id;
		}
	}
}

exports.SqlCore= SqlCore;
