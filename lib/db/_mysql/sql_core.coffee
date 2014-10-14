#
#	Core DB Functions. Includes DB Pool
#

Q= 		require 'q'
E= 		require '../../error'
mysql= 	require 'mysql'

_log= false
_log2= debug: ()->

class SqlCore
	constructor: (pool_opts, log)->
		_log= log
		# _log2= log # Uncomment to turn level 2 debug on
		@pool= mysql.createPool pool_opts
		@acquire= (callback)-> @pool.getConnection callback
		@Acquire= Q.nbind @acquire, this
		@release= (conn)->
			_log2.debug 'DB:SqlCore:release:', 'releasing conn'
			conn.release()
		@destroy= (conn)->
			_log2.debug 'DB:SqlCore:destroy:', 'destroying conn'
			conn.destroy

		@sqlQuery= (ctx, sql, args)->
			_log2.debug 'DB:SqlCore:sqlQuery:', sql
			_log2.debug 'DB:SqlCore:args:', args if args
			throw new E.DbError 'DB:SQL:BAD_CONN' if ctx.conn is null
			(Q.ninvoke ctx.conn, 'query', sql, args)
			.then (rows_n_cols) ->
				rows_n_cols[0]

	StartTransaction: (ctx)=> # Assumes conn on ctx
		f= 'DB:SqlCore:StartTransaction'

		Q.resolve()
		.then =>

			# Initialize the transaction
			@sqlQuery ctx, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
		.then (db_result)=>

			# Start the transaction
			@sqlQuery ctx, 'START TRANSACTION'
		.then (db_result) ->
			null

	# Factory for attaching common functions to SQL Modules
	# GetCollection (ctx)
	# GetByKey (ctx, key, ids)
	# UpdateByKey (ctx, key, ids, new_values)
	# DisposeByIds (ctx, ids)
	# get_by_id (ctx, id) # TODO: Remove
	# Create (ctx, new_values, re_read)
	# UpdateById (ctx, id, new_values, re_read)
	# DeleteById (ctx, id)
	method_factory: (sql_mod, name)=>
		table= 		sql_mod.table
		ident_tbl=  sql_mod.ident_tbl
		schema= 	sql_mod.schema
		sqlQuery= @sqlQuery

		if schema.GetByKey
			sql_mod.GetByKey= (ctx, key, ids)->
				f= "DB:#{name}:GetByKey:"
				ctx.log.debug f, key

				Q.resolve()
				.then =>

					throw new E.DbError "DB:CORE:SCHEMA_UNDEFINED:GetByKey_#{key}" unless schema.GetByKey[key]
					sql= 'SELECT '+ (schema.GetByKey[key].join ',')+ ' FROM '+ table+
						' WHERE di= 0 AND '+ key+ ' IN (?)'
					sqlQuery ctx, sql, [ ids]
				.then (db_rows)->
					db_rows

		if schema.UpdateByKey
			sql_mod.UpdateByKey= (ctx, key, ids, new_values)->
				f= "DB:#{name}:UpdateByKey:"
				ctx.log.debug f, key

				throw new E.DbError "DB:CORE:SCHEMA_UNDEFINED:UpdateByKey_#{key}" unless schema.UpdateByKey[key]
				for nm,val of new_values when nm not in schema.UpdateByKey[key]
					throw new E.DbError "UPDATE_BY_KEY:COL_NOT_IN_SCHEMA", { col: nm, value: val}

				Q.resolve()
				.then ()=>

					cols= []; arg=[]
					(cols.push nm + '= ?'; arg.push val) for nm, val of new_values
					arg.push ids
					sql= 'UPDATE '+ table+ ' SET '+ (cols.join ',')+
						' WHERE '+ key+ ' IN (?) AND di= 0'
					sqlQuery ctx, sql, arg
				.then (db_result)=>
					db_result


		if schema.DisposeByIds
			sql_mod.DisposeByIds= (ctx, ids)->
				f= "DB:#{name}:DisposeByIds:"
				ctx.log.debug f, ids

				Q.resolve()
				.then =>

					sql= 'UPDATE '+ table+ ' SET di= 1 WHERE id IN (?)'
					sqlQuery ctx, sql, [ ids]
				.then (db_result)=>
					db_result

		if schema.get_collection or schema.GetCollection
			get_collection= (ctx)->
				f= "DB:#{name}:get_collection:"
				schema_cols= schema.get_collection ? schema.GetCollection

				Q.resolve()
				.then =>

					sql= 'SELECT '+ (schema.schema_cols.join ',')+ ' FROM '+ table+
						' WHERE di= 0'
					sqlQuery ctx, sql
				.then (db_rows)->
					db_rows
			sql_mod.get_collection= get_collection # Deprecated
			sql_mod.GetCollection= get_collection

		if schema.get_by_id # Deprecated. Use GetByKey with 'id' # TODO: Remove when nothing uses it
			sql_mod.get_by_id= (ctx, id)->
				f= "DB:#{name}:get_by_id:"

				Q.resolve()
				.then =>

					sql= 'SELECT ' + (schema.get_by_id.join ',') + ' FROM ' + table + ' WHERE id= ? AND di= 0'
					sqlQuery ctx, sql, [id]
				.then (db_rows)->
					db_rows

		if schema.create or schema.Create
			create= (ctx, new_values, re_read)->
				f= "DB:#{name}:create:"
				_log2.debug f, new_values
				schema_cols= schema.create ? schema.Create
				result= false

				for nm, val of new_values when nm not in schema_cols
					throw new E.DbError "DB:CORE:BAD_INSERT_COL_#{table}_#{nm}"

				Q.resolve()
				.then ()=>

					cols= ['cr']; qs= ['?']; arg= [null]
					(cols.push nm; qs.push '?'; arg.push val) for nm, val of new_values
					sql= 'INSERT INTO ' + table + ' (' + (cols.join ',') + ') VALUES (' + (qs.join ',') + ')'
					sqlQuery ctx, sql, arg
				.then (db_result)=>
					result= db_result
					throw new E.DbError f+'NO_INSERT' if db_result.affectedRows isnt 1

					return false unless re_read is true
					throw new E.ServerError f+'REREAD_NOT_DEFINED_IN_SCHEMA' unless schema.reread
					sql= 'SELECT ' + (schema.reread.join ',') + ' FROM ' + table + ' WHERE id= ? AND di= 0'
					sqlQuery ctx, sql, [db_result.insertId]
				.then (db_rows)->
					if db_rows isnt false
						throw new E.NotFoundError f+'REREAD' if db_rows.length isnt 1
						result= db_rows[0]
					result
			sql_mod.create= create # Deprecated
			sql_mod.Create= create

		if schema.update_by_id or schema.UpdateById
			update_by_id= (ctx, id, new_values, re_read)->
				f= "DB:#{name}:update_by_id:"
				_log2.debug f, { id, new_values, re_read }
				schema_cols= schema.update_by_id ? schema.UpdateById
				result= false

				for nm, val of new_values when nm not in schema_cols
					throw new E.DbError 'Invalid ' + table + ' Update Column', col: nm, value: val

				Q.resolve()
				.then =>

					cols= []; arg=[]
					(cols.push nm + '= ?'; arg.push val) for nm, val of new_values
					arg.push id
					sql= 'UPDATE ' + table + ' SET ' + (cols.join ',') +
						' WHERE id= ? AND di= 0'
					sqlQuery ctx, sql, arg
				.then (db_result)=>
					result= db_result

					return false unless re_read is true
					throw new E.ServerError f+'REREAD_NOT_DEFINED_IN_SCHEMA' unless schema.reread
					sql= 'SELECT ' + (schema.reread.join ',') + ' FROM ' + table + ' WHERE id= ? AND di= 0'
					sqlQuery ctx, sql, [id]
				.then (db_rows)->
					if db_rows isnt false
						throw new E.NotFoundError f+'REREAD' if db_rows.length isnt 1
						result= db_rows[0]
					result
			sql_mod.update_by_id= update_by_id # Deprecated
			sql_mod.UpdateById= update_by_id

		if schema.delete_by_id or schema.DeleteById
			delete_by_id= (ctx, id)->
				f= "DB:#{name}:delete_by_id:"
				_log.debug f, id

				Q.resolve()
				.then ()=>

					sql= 'DELETE FROM ' + table + ' WHERE id= ?'
					@db.sqlQuery ctx, sql, [ id ]
				.then (db_result)=>
					db_result
			sql_mod.delete_by_id= delete_by_id # Deprecated
			sql_mod.DeleteById= delete_by_id

exports.SqlCore= SqlCore
