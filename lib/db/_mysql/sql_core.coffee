#
#	Core DB Functions. Includes DB Pool
#

mysql= require 'mysql'
{Pool}= require 'generic-pool' # TODO: Remove Generic Pool. Use MySQL Pool
Q= require 'q'
E= require '../../error'

_log= false

class SqlCore
	constructor: (config, log)->
		_log= log
		@pool= Pool
			name: 'mysql - Blueprint'
			create: (cb)->
				conn= mysql.createConnection(config);
				cb(null, conn)
			destroy: (conn)-> conn.end()
			max: config.maxConnections
			min: config.minConnections
			idleTimeoutMillis: config.idleTimeoutMillis
			log: false
		@acquire= (callback)-> @pool.acquire callback
		@Acquire= Q.nbind @acquire, this
		@release= (conn)-> @pool.release conn
		@destroy= (conn)-> @pool.destroy conn

		@sqlQuery= (conn, sql, args)->
			_log.debug 'SqlCore:sqlQuery:', sql
			_log.debug 'SqlCore:args:', args if args
			(Q.ninvoke conn, 'query', sql, args)
			.then (rows_n_cols) ->
				rows_n_cols[0]

	AcquireTxConn: ()=>
		conn= false

		@Acquire()
		.then (c) =>
			conn= c

			# Initialize the transaction
			sql= 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE'
			@sqlQuery conn, sql
		.then (db_result)=>

			# Start the transaction
			sql= 'START TRANSACTION'
			@sqlQuery conn, sql
		.then (db_result) ->

			# Pass the conn
			conn

	# Factory for attaching common functions to SQL Modules
	# get_collection (conn)
	# get_by_ident_id (conn, ident_id)
	# create (conn, new_values)
	# update_by_ident_id (conn, ident_id, new_values)
	method_factory: (sql_mod, name)=>
		table= 		sql_mod.table
		ident_tbl=  sql_mod.ident_tbl
		schema= 	sql_mod.schema
		sqlQuery= @sqlQuery

		if schema.get_collection
			sql_mod.get_collection= (conn)->
				f= "DB:#{name}:get_collection:"

				Q.resolve()
				.then =>

					sql= 'SELECT * FROM ' + table
					sqlQuery conn, sql
				.then (db_rows)->
					db_rows

		if schema.create
			sql_mod.create= (conn, new_values)->
				f= "DB:#{name}:create:"
				_log.debug f, new_values

				for nm, val of new_values when nm not in schema.create
					throw new E.ServerError 'Invalid ' + table + ' Insert Column', col: nm, value: val

				Q.resolve()
				.then =>

					cols= []; qs= []; arg= []
					(cols.push nm; qs.push '?'; arg.push val) for nm, val of new_values
					sql= 'INSERT INTO ' + table + ' (' + (cols.join ',') + ') VALUES (' + (qs.join ',') + ')'
					sqlQuery conn, sql, arg
				.then (db_result)=>
					db_result

		if schema.update_by_ident_id
			sql_mod.update_by_ident_id= (conn, ident_id, new_values)->
				f= "DB:#{name}:update_by_ident_id:"
				_log.debug f, ident_id, new_values

				for nm, val of new_values when nm not in schema.update_by_ident_id
					throw new E.DbError 'Invalid ' + table + ' Update Column', col: nm, value: val

				Q.resolve()
				.then =>

					cols= []; arg=[]
					(cols.push nm + '= ?'; arg.push val) for nm, val of new_values
					arg.push ident_id
					sql= 'UPDATE ' + table + ' SET '+ (cols.join ',') +
						' WHERE ident_id= ? AND di= 0'
					sqlQuery conn, sql, arg
				.then (db_result)=>
					db_result

		if schema.update_by_id
			sql_mod.update_by_id= (conn, id, new_values)->
				f= "DB:#{name}:update_by_id:"
				_log.debug f, id, new_values

				for nm, val of new_values when nm not in schema.update_by_id
					throw new E.DbError 'Invalid ' + table + ' Update Column', col: nm, value: val

				Q.resolve()
				.then =>

					cols= []; arg=[]
					(cols.push nm + '= ?'; arg.push val) for nm, val of new_values
					arg.push id
					sql= 'UPDATE ' + table + ' SET '+ (cols.join ',') +
						' WHERE id= ? AND di= 0'
					sqlQuery conn, sql, arg
				.then (db_result)=>
					db_result

		if schema.get_by_ident_id
			sql_mod.get_by_ident_id= (conn, ident_id)->
				f= "DB:#{name}:get_by_ident_id:"
				_log.debug f, ident_id

				Q.resolve()
				.then =>

					sql= 'SELECT '+ (schema.get_by_ident_id.join ',') +
						' FROM ' + ident_tbl + ' i LEFT OUTER JOIN ' + table + ' e' +
						' ON i.id= e.ident_id WHERE i.id= ? AND i.di= 0 AND (e.di= 0 OR e.id IS NULL)'
					sqlQuery conn, sql, [ident_id]
				.then (db_rows) ->
					db_rows

exports.SqlCore= SqlCore