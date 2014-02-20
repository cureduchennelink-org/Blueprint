#
#	Core DB Functions. Includes DB Pool
#

mysql= require 'mysql'
{Pool}= require 'generic-pool'
Q= require 'q'

class SqlCore
	constructor: (config, log)->
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
			log.debug 'sqlQuery:', sql, args
			(Q.ninvoke conn, 'query', sql, args)
			.then (rows_n_cols) ->
				rows_n_cols[0]

exports.SqlCore= SqlCore