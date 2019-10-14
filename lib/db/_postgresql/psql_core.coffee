#
#	Core DB Functions. Includes DB Pool
#

Promise=	require 'bluebird'
{ Pool, Client }= require 'pg'
{CommonCore}= require '../CommonCore'


class PostgreSqlCore extends CommonCore
	@deps= services: ['error','logger']
	constructor: (kit, pool_opts)->
		@f = 'PostgreSqlCore'
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

		#		CRB: args must be an array because there are many commands we make that don't use arguments
		# 	CommonCore.js 29:9 sets the transaction level as serializable and doesn't use an argument
		@sqlQuery= (ctx, sql, args = [])=>
			f = "#{@f}:sqlQuery::"
			ctx.log.debug 'DB:PostgreSqlCore:sqlQuery:', sql if @is_db_log_on
			ctx.log.debug 'DB:PostgreSqlCore:args:', args if args and @is_db_log_on
			throw new @E.InvalidArg f + "args must be an array!" if args and !Array.isArray args
			throw new @E.DbError 'DB:PostgreSQL:BAD_CONN' if ctx.conn is null
			statement = sql
			query= Promise.promisify ctx.conn.query, context: ctx.conn
			Promise.resolve().bind @
			.then ->
				for value, index in args
					if Array.isArray value
						statement.replace 'IN (?)', '= ANY($'+(index+1)+')'
					else
						statement = statement.replace '?', '$'+(index+1)

				query statement, args
			.then (just_rows)->
				ctx.log.debug 'DB:PostgreSqlCore:result:', just_rows if @is_db_log_on
				just_rows.rows


exports.PostgreSqlCore= PostgreSqlCore