Promise= require 'bluebird'

{ObjectId} = require 'mongodb'
SERVICE_NAME= process.env.npm_package_name || "blueprint"

class HealthCheck
	@deps= services:[ 'logger', 'error', 'ses', 'lamd']
	constructor: (kit)->
		@E= kit.services.error
		@log= kit.services.logger.log
		@lamd= kit.services.lamd
		@ses= kit.services.ses
		@ses_email_config= kit.services.config.ses.emails
		@config= kit.services.config
		# ServiceHealth
		@all_services= kit.services
		@services= {} # Populate with list of services that implement a health-check method

		# Lead Endpoints
		@endpoints=
			getLogs:
				verb: 'get', route: '/Logs'
				use: on, wrap: 'default_wrap', version: any: @_GetLogs
				sql_conn: off, auth_required: off
			pingAuth:
				verb: 'get', route: '/PingAuth'
				use: on, wrap: 'default_wrap', version: any: @_GetPing
				sql_conn: off, auth_required: on
			getPing:
				verb: 'get', route: '/Ping'
				use: on, wrap: 'default_wrap', version: any: @_GetPing
				sql_conn: off, auth_required: off
			getDebug:
				verb: 'get', route: '/Debug/:req_uuid', lamd: false
				use: on, wrap: 'default_wrap', version: any: @_GetDebug
				sql_conn: off, auth_required: off
			getHealth:
				verb: 'get', route: '/Health', lamd: false
				use: on, wrap: 'default_wrap', version: any: @_ServiceHealth
				sql_conn: on, auth_required: off

	server_init: ->
		# ServiceHealth
		@services[ nm]= @all_services[ nm] for nm of @all_services when typeof @all_services[ nm].HealthCheck is 'function'

	_ServiceHealth: (ctx, pre_loaded)=>
		use_doc=
			params:
				any: '{ANY} - reflected back in params:'
				service: '{String} - optional service name e.g. RunQueue to query for health-check'
				red: '{Number} - optional, status code when service is "red"'
				yellow: '{Number} - optional, status code when service is "yellow"'
			response: success: '{Bool}', params: '{Ojbect}', health: '{Object}'
		return use_doc if ctx is 'use'
		f= 'R_Status:_Get:'
		p= ctx.p
		send= success: false, service_name: SERVICE_NAME, params: p, service: false, services: (nm for nm of @services)

		Promise.resolve().bind @
		.then ->
			return false unless p.service of @services

			@services[ p.service].HealthCheck ctx
		.then (result)->
			if result isnt false
				send.service= result unless result is false
				ctx.res.status Number p.red if p.red? and result?.status is 'r'
				ctx.res.status Number p.yellow if p.yellow? and result?.status is 'y'

			# Return back to the Client
			send.success= true
			{send}

	_GetDebug: (ctx, pre_loaded)=>
		use_doc=
			params:
				device: '{String}-FUTURE'
			response:
				success: '{Bool}'
				debug: '{Array}'
		return use_doc if ctx is 'use'
		f= 'R_Debug:_Get:'
		p= ctx.p
		send= success: true, debug: []
		len= p.req_uuid?.length
		throw new @E.InvalidArg 'req_uuid:'+ len+ 'L' unless len > 35

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

	_GetLogs: (ctx, pre_loaded)=>
		use_doc=
			params:
				type: '{String}'
				filt: '{String} - report specific filter value'
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
				projection: {"_id": 0, "statusCode":1, "date":1, "route":1,"verb":1,"err":1,"req_uuid":1}
				sort: { $natural:-1 }
			last100:
				subject: 'Last Query'
				query: {}
				projection: {"_id": 0, "statusCode":1, "date":1, "job_name":1, "result.did_work":1, "route":1,"verb":1,"err":1,"req_uuid":1}
				sort: { $natural:-1 }
			last100jobwork:
				subject: 'Last jobs with result.did_work true'
				query: {"result.did_work": true}
				projection: {"_id": 0, "result":1, "date":1, "job_name":1, "err":1,"req_uuid":1}
				sort: { $natural:-1 }
			deadlocks:
				subject: 'API Deadlocks'
				query: {"_id": {"$gt": new ObjectId( Math.floor(new Date(new Date()-1000*60*60).getTime()/1000).toString(16) + "0000000000000000")},"err.code" : "ER_LOCK_DEADLOCK"}
				projection: {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1,"req_uuid":1}
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
		if p.filt
			switch p.type
				when 'last100jobwork'
					query[ "result.filter.contest.id"]= Number p.filt

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

	_GetPing: (ctx, pre_loaded)=>
		use_doc=
			params:
				dummy: '{String}'
			response:
				success: '{Bool}'
		return use_doc if ctx is 'use'
		f= 'R_Health:_GetPing:'
		p= ctx.p
		success= false

		# Return back to the Client
		success= true
		send: {success, request_count: ctx.lamd.request_count, request_count_high: ctx.lamd.request_count_high, config: api: @config.api}

exports.HealthCheck= HealthCheck
