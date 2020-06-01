#
#	Agent-header DB methods
#
# browser_name: 'Chrome',
# browser_version: '44.0.2403.157',
# browser_major: '44',
# engine_name: 'WebKit',
# engine_version: '537.36',
# os_name: 'Linux',
# os_version: 'x86_64',
# device_model: undefined,
# device_vendor: undefined,
# device_type: undefined,
# cpu_architecture: 'amd64'
#
#
Promise= require 'bluebird'

class SqlAgentHeader
	@deps: services: [ 'error' ]
	constructor: (core, kit)->
		@db= core
		@E= kit.services.error
		@table= 'agent_header'
		@schema=
			InsertIfNew: [
				'browser_name', 'browser_version', 'browser_major',
				'engine_name', 'engine_version', 'os_name', 'os_version',
				'device_model', 'device_vendor', 'device_type', 'cpu_architecture'
				]
			GetByKey: agent_header: [ 'id']

		@db.method_factory @, 'SqlAgentHeader'

	InsertIfNew: (ctx, agent_header, more_values)->
		f= "SqlAgentHeader.InsertIfNew:"
		ctx.log.debug f, {agent_header, more_values}

		extra_cols= @schema.InsertIfNew

		for nm, val of more_values when nm not in extra_cols
			throw new @db.E.DbError f+":BAD_INSERT_COL-#{@table}-#{nm}"

		Promise.resolve().bind @
		.then ->
			cols=[ 'agent_header', 'agent_header_md5']
			qs=[ '?', 'MD5( ?)']
			args=[ agent_header, agent_header, ]
			(cols.push nm; qs.push '?'; args.push val) for nm, val of more_values

			sql= """
				INSERT INTO #{@table} (cr, #{cols})
				VALUES (null, #{qs})
				ON DUPLICATE KEY UPDATE id= id, dummy= NOT dummy
			"""

			@db.sqlQuery ctx, sql, args
		.then (db_result)->
			return db_result

exports.SqlAgentHeader= SqlAgentHeader
