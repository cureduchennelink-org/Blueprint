#
#	Core DB Functions. Includes DB Pool
#

Promise=	require 'bluebird'
{ Pool, Client }= require 'pg'
{CommonCore}= require 'CommonCore'


class PostgreSqlCore extends CommonCore
	@deps= services: ['error','logger']
	constructor: (kit, pool_opts)->
		@E= kit.services.error
		_log2= if pool_opts.level2_debug then kit.services.logger.log else debug: ->
		@is_db_log_on= pool_opts.level2_debug
		@pool= new Pool pool_opts
		@acquire= (callback)-> @pool.connect callback
		@Acquire= Promise.promisify @acquire, context: @
		@release= (conn)->
			_log2.debug 'DB:PostgreSqlCore:release:', 'releasing conn'
			conn.release()
		@destroy= (conn)->
			_log2.debug 'DB:PostgreSqlCore:destroy:', 'destroying conn'
			conn.end()

		@sqlQuery= (ctx, sql, args)=>
			ctx.log.debug 'DB:PostgreSqlCore:sqlQuery:', sql if @is_db_log_on
			ctx.log.debug 'DB:PostgreSqlCore:args:', args if args and @is_db_log_on
			throw new @E.DbError 'DB:PostgreSQL:BAD_CONN' if ctx.conn is null
			query= Promise.promisify ctx.conn.query, context: ctx.conn
			Promise.resolve().bind @
			.then ->
				for index, value in (if args instanceof Array then args else [])
					if value instanceof Array
						sql.replace('IN (?)', '= ANY($'+(index+1)+')', index)
					else
						sql.replace('?', '$'+(index+1), index)

				query sql, args
			.then (just_rows)->
				ctx.log.debug 'DB:PostgreSqlCore:result:', just_rows if @is_db_log_on
				just_rows


exports.PostgreSqlCore= PostgreSqlCore