#
#	Core DB Functions. Includes DB Pool
#

Promise=	require 'bluebird'

class CommonCore
	@deps= services: ['error','logger']
	constructor: (kit, pool_opts)->
		@E= kit.services.error
		_log2= if pool_opts.level2_debug then kit.services.logger.log else debug: ->
		@is_db_log_on= pool_opts.level2_debug
		

	StartTransaction: (ctx)=> # Assumes conn on ctx
		f= 'DB:SqlCore:StartTransaction'

		Promise.resolve().bind @
		.then ->

			# Initialize the transaction
			@sqlQuery ctx, 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
		.then ->

			# Start the transaction
			@sqlQuery ctx, 'START TRANSACTION'
		.then ->
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
		throw new @E.ServerError "DB:CORE:MOD_TABLE", "table undefined for #{name}" unless sql_mod.table
		throw new @E.ServerError "DB:CORE:MOD_SCHEMA", "schema undefined for #{name}" unless sql_mod.schema
		table= 		sql_mod.table
		ident_tbl=  sql_mod.ident_tbl
		schema= 	sql_mod.schema
		sqlQuery= @sqlQuery

		if schema.GetByKey
			sql_mod.GetByKey= (ctx, key, ids, lock)=>
				f= "DB:#{name}:GetByKey:"
				ctx.log.debug f, key if @is_db_log_on

				Promise.resolve().bind @
				.then ->

					throw new @E.DbError "DB:CORE:SCHEMA_UNDEFINED:GetByKey_#{key}" unless schema.GetByKey[key]
					sql= """
						SELECT #{schema.GetByKey[key].join ','}
						FROM #{table}
						WHERE di= 0 AND #{key} IN (?)
						 """
					sql += ' FOR UPDATE' if lock
					sqlQuery ctx, sql, [ ids]
				.then (db_rows)->
					db_rows

		if schema.UpdateByKey
			sql_mod.UpdateByKey= (ctx, key, ids, new_values)=>
				f= "DB:#{name}:UpdateByKey:"
				ctx.log.debug f, key if @is_db_log_on

				throw new @E.DbError "DB:CORE:SCHEMA_UNDEFINED:UpdateByKey_#{key}" unless schema.UpdateByKey[key]
				for nm,val of new_values when nm not in schema.UpdateByKey[key]
					throw new @E.DbError "UPDATE_BY_KEY:COL_NOT_IN_SCHEMA", { col: nm, value: val}

				Promise.resolve().bind @
				.then ()->

					cols= []; arg=[]
					(cols.push nm + '= ?'; arg.push val) for nm, val of new_values
					arg.push ids
					sql= """
						UPDATE #{table} SET #{cols.join ','}
						WHERE #{key} IN (?) AND di= 0
						 """
					sqlQuery ctx, sql, arg
				.then (db_result)->
					db_result

		if schema.DisposeByIds
			sql_mod.DisposeByIds= (ctx, ids)=>
				f= "DB:#{name}:DisposeByIds:"
				ctx.log.debug f, ids if @is_db_log_on

				# TODO JCS PERFORMANCE: SINCE sqlQuery ALREADY RETURNS A PROMISE, CONSIDER JUST CALLING IT W/O PROMISE AND TWO .THENS
				Promise.resolve().bind @
				.then ->

					sql= """
					UPDATE #{table} SET di= 1 WHERE id IN (?)
						 """
					sqlQuery ctx, sql, [ ids]
				.then (db_result)->
					db_result

		if schema.get_collection or schema.GetCollection
			get_collection= (ctx)=>
				f= "DB:#{name}:get_collection:"
				ctx.log.debug f if @is_db_log_on
				schema_cols= schema.get_collection ? schema.GetCollection
				Promise.resolve().bind @
				.then ->

					sql= """
						SELECT #{schema_cols.join ','}
						FROM #{table}
						WHERE di= 0
						 """
					sqlQuery ctx, sql
				.then (db_rows)->
					db_rows
			sql_mod.get_collection= get_collection # Deprecated
			sql_mod.GetCollection= get_collection

		if schema.get_by_id # Deprecated. Use GetByKey with 'id' # TODO: Remove when nothing uses it
			sql_mod.get_by_id= (ctx, id)=>
				f= "DB:#{name}:get_by_id:"
				ctx.log.debug f, id if @is_db_log_on

				Promise.resolve().bind @
				.then ->

					sql= """
						SELECT #{schema.get_by_id.join ','}
						FROM #{table}
						WHERE id= ? AND di= 0
						 """
					sqlQuery ctx, sql, [id]
				.then (db_rows)->
					db_rows

		if schema.create or schema.Create
			create= (ctx, new_values, re_read)=>
				f= "DB:#{name}:create:"
				ctx.log.debug f, new_values if @is_db_log_on
				schema_cols= schema.create ? schema.Create
				result= false

				for nm, val of new_values when nm not in schema_cols
					throw new @E.DbError "DB:CORE:BAD_INSERT_COL-#{table}-#{nm}"

				Promise.resolve().bind @
				.then ->

					cols= ['cr']; qs= ['?']; arg= [null]
					(cols.push nm; qs.push '?'; arg.push val) for nm, val of new_values
					sql= """
						INSERT INTO #{table} (#{cols.join ','}) VALUES (#{qs.join ','}) RETURNING id
						 """
					sqlQuery ctx, sql, arg
				.then (db_result)->
					result= db_result
					throw new @E.DbError f+'NO_INSERT' if db_result.length isnt 1

					return false unless re_read is true
					throw new @E.ServerError f+'REREAD_NOT_DEFINED_IN_SCHEMA' unless schema.reread
					sql= """
						SELECT #{schema.reread.join ','} 
						FROM #{table} 
						WHERE id= ?
						 """
					sqlQuery ctx, sql, [db_result[0].id]
				.then (db_rows)->
					if db_rows isnt false
						throw new @E.NotFoundError f+'REREAD' if db_rows.length isnt 1
						result= db_rows[0]
					result

			sql_mod.create= create # Deprecated
			sql_mod.Create= create

		if schema.update_by_id or schema.UpdateById
			update_by_id= (ctx, id, new_values, re_read)=>
				f= "DB:#{name}:update_by_id:"
				ctx.log.debug f, { id, new_values, re_read } if @is_db_log_on
				schema_cols= schema.update_by_id ? schema.UpdateById
				result= false

				for nm, val of new_values when nm not in schema_cols
					throw new @E.DbError 'Invalid ' + table + ' Update Column', col: nm, value: val

				Promise.resolve().bind @
				.then ->

					cols= []; arg=[]
					(cols.push nm + '= ?'; arg.push val) for nm, val of new_values
					arg.push id
					sql= """
						UPDATE #{table} SET #{cols.join ','}
						WHERE id= ? AND di= 0
						 """
					sqlQuery ctx, sql, arg
				.then (db_result)->
					result= db_result

					return false unless re_read is true
					throw new @E.ServerError f+'REREAD_NOT_DEFINED_IN_SCHEMA' unless schema.reread
					sql= """
						SELECT #{schema.reread.join ','}
						FROM #{table}
						WHERE id= ?
						 """
					sqlQuery ctx, sql, [id]
				.then (db_rows)->
					if db_rows isnt false
						throw new @E.NotFoundError f+'REREAD' if db_rows.length isnt 1
						result= db_rows[0]
					result
			sql_mod.update_by_id= update_by_id # Deprecated
			sql_mod.UpdateById= update_by_id

		if schema.delete_by_id or schema.DeleteById
			delete_by_id= (ctx, id)=>
				sql= """
					DELETE FROM #{table}
					WHERE id= ?
					 """
				(sqlQuery ctx, sql, [ id ])
				.then (db_result)=> db_result

			sql_mod.delete_by_id= delete_by_id # Deprecated
			sql_mod.DeleteById= delete_by_id

exports.CommonCore= CommonCore