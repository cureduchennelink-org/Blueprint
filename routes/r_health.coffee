Promise= require 'bluebird'

{ObjectId} = require 'mongodb'

class HealthCheck
	@deps= services:[ 'logger', 'error', 'ses', 'lamd']
	constructor: (kit)->
		@E= kit.services.error
		@log= kit.services.logger.log
		@lamd= kit.services.lamd
		@ses= kit.services.ses
		@ses_email_config= kit.services.config.ses.emails
		@config= kit.services.config

		# Lead Endpoints
		@endpoints=
			getHealth:
				verb: 'get', route: '/Health'
				use: on, wrap: 'default_wrap', version: any: @_GetHealth
				sql_conn: off, auth_required: off
			pingAuth:
				verb: 'get', route: '/PingAuth'
				use: on, wrap: 'default_wrap', version: any: @_GetPingAuth
				sql_conn: off, auth_required: on
			ping:
				verb: 'get', route: '/Ping'
				use: on, wrap: 'simple_wrap', version: any: @_GetPing
				sql_conn: off, auth_required: off
			getStatus:
				verb: 'get', route: '/Status'
				use: on, wrap: 'default_wrap', version: any: @_GetStatus
				sql_conn: off, auth_required: off
			getDebug:
				verb: 'get', route: '/Debug', lamd: false
				use: on, wrap: 'default_wrap', version: any: @_GetDebug
				sql_conn: off, auth_required: off

	_GetDebug: (ctx, pre_loaded)=>
		use_doc=
			params:
				device: '{String}-FUTURE'
				req_uuid: '{String}'
			response:
				success: '{Bool}'
				debug: '{Array}'
		return use_doc if ctx is 'use'
		f= 'R_Debug:_Get:'
		p= ctx.p
		send= success: true, debug: []
		len= p.req_uuid?.length
		throw new @E.InvalidArg 'req_uuid:'+ len unless len is 'a27af922-b891-45e7-b422-b50192db1928'.length

		Promise.resolve().bind @
		.then ->

			method= 'find'
			query= { "_id": p.req_uuid}
			projection= {} # {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1}
			options = {}
			hint= {}
			sort= {} # { $natural:-1 }
			@lamd.read_deep ctx, method, query, projection, options, hint, sort
		.then (db_results) ->
			send.debug= db_results

			{send}


	_GetPingAuth: (ctx, pre_loaded)=>
		use_doc=
			params:
				dummy: '{String}'
			response:
				success: '{Bool}'
		return use_doc if ctx is 'use'
		send: {success:true}

	_GetPing: (req, res, next)=>
		use_doc=
			params:
				dummy: '{String}'
			response:
				success: '{Bool}'
		return use_doc if req is 'use'
		res.send success:true
		next()

	_GetHealth: (ctx, pre_loaded)=>
		use_doc=
			params:
				type: '{String}'
			response: success: '{Bool}'
		return use_doc if ctx is 'use'
		f= 'R_Health:_Get:'
		p= ctx.p
		success= false
		lamd_results = []

		method = "find"
		query = {}
		projection = {}
		options = {}
		hint= {}
		sort= {}
		type_map =
			lastbad100:
				subject: 'Last Bad Queries'
				query: { "statusCode": { $ne: 200 }}
				projection: {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1}
				sort: { $natural:-1 }
			last100:
				subject: 'Last Query'
				query: {}
				projection: {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1}
				sort: { $natural:-1 }
			deadlocks:
				subject: 'API Deadlocks'
				query: {"_id": {"$gt": new ObjectId( Math.floor(new Date(new Date()-1000*60*60).getTime()/1000).toString(16) + "0000000000000000")},"err.code" : "ER_LOCK_DEADLOCK"}
				projection: {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1}
				hint: {"err.code":1}
			daily:
				subject: 'Daily Aggregations API'
				query: [{$match:{"_id": {$gt:new ObjectId( Math.floor(new Date(new Date()-1000*60*60*24).getTime()/1000).toString(16) + "0000000000000000" )}, "statusCode":{"$ne":406}}},{ "$group": {"_id": { "statusCode":"$statusCode", "route": "$route", "err": "$err.proxy_error", "err_code": "$err" }, "count":{ "$sum": 1 }}}, {$sort:{"count":-1}}]
				method: "aggregate"

		throw new @E.MissingArg "Bad Health Type (options: #{nm for nm of type_map}) - using: #{p.type}" unless p.type of type_map

		subject= type_map[p.type].subject
		method= type_map[p.type].method ? method
		query= type_map[p.type].query
		projection= type_map[p.type].projection ? projection
		options= type_map[p.type].options ? options
		hint= type_map[p.type].hint ? hint
		sort= type_map[p.type].sort ? sort


		Promise.resolve().bind @
		.then ->

			@lamd.read ctx, method, query, projection, options, hint, sort
		.then (db_results) ->
			lamd_results = db_results

			email_results = ["deadlocks","deadlocks_backend","daily","daily_backend"]
			return false unless lamd_results.length > 0 and email_results.indexOf(p.type) > -1
			recipient= { reason: subject, type: p.type, eml: @ses_email_config.alert.To }
			epicmvc_tables=
				Details: [ { msg: JSON.stringify(lamd_results, null, 2) } ]
				Recipient: [ recipient ]
			@ses.send 'alert', epicmvc_tables
		.then ()->

			success= true
			send: {success, num_results: lamd_results.length, results: lamd_results }

	_GetStatus: (ctx, pre_loaded)=>
		use_doc=
			params:
				dummy: '{String}'
			response:
				success: '{Bool}'
		return use_doc if ctx is 'use'
		f= 'R_Health:_GetStatus:'
		p= ctx.p
		success= false

		# Return back to the Client
		success= true
		send: {success, request_count: ctx.lamd.request_count, request_count_high: ctx.lamd.request_count_high, config: api: @config.api}

exports.HealthCheck= HealthCheck
