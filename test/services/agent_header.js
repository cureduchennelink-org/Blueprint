#
# TEST: AgentHeader service (and SqlAgentHeader class)
#

Promise= require 'bluebird'
_= require 'lodash'
server= require '../..'
uuid= require 'uuid'

chai= 	require 'chai'
chai.should()		# Should Expectation Library

_log= console.log

describe 'AgentHeader:service:', ()->
	f= 'AgentHeader:service'
	uid= ' - '+ uuid.v4()
	# Place these in the closure, to be propulated async by before logic
	agent_string_1= 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36'+ uid
	agent_string_2= 'Mozilla/5.0 (Linux; Android 4.1; Nexus 7 Build/JRN84D) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.166 Safari/535.19'+ uid
	agent_string_3= 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'+ uid+ ' #PRE-ENTERED'
	agent_string_4= 'curl/7.19.7 (i386-redhat-linux-gnu)'+ uid
	next_expected_id= 0
	already_added_id= 0
	module= false # This is the module under test (appears in DVblueprint in kit.services upon startup)
	base_ctx= log: debug: console.log
	db_stuff= []

	kit= false # Closure
	sdb= false # Closure
	after -> kit.services.server?.server.close()
	before ->
		Promise.resolve()
		.then ->
			config_extra=
				db:
					mysql:
						pool:
							level2_debug: true
						modules:
							agent_header: file: 'lib/db/_mysql/sql_agent_header' # Remove node_modules/blueprint/
				service_modules:
					db: file: 'lib/db' # Remove node_modules/blueprint/
					AgentHeader: file: 'lib/agent_header' # Remove node_modules/blueprint/
			mysql_mods= []
			mysql_mods.push 'agent_header'
			server.start false, [ 'AgentHeader', ], [], true, mysql_mods, false, config_extra
		.then (the_kit)->
			kit= the_kit
			module= kit.services.AgentHeader
			sdb= kit.services.db.mysql

			# wrapper was populating ctx.conn
			sdb.core.Acquire()
		.then (c) ->
			base_ctx.conn= c

			# Have a DB entry so it is not in the cache
			sdb.core.sqlQuery base_ctx, 'INSERT INTO agent_header (agent_header, agent_header_md5) VALUES (?, MD5(?))', [agent_string_3, agent_string_3]
		.then (db_results)->
			already_added_id= db_results.insertId

			# Get spot to start to track what this module generates
			sdb.core.sqlQuery base_ctx, 'SELECT id FROM agent_header ORDER BY id desc LIMIT 1'
		.then (db_rows)->
			next_expected_id= if db_rows.length then db_rows[ 0].id+ 1 else 1

	it 'adds', ()->
		s= false
		Promise.resolve()
		.then ->
			module.xlate s= agent_string_1+ " ##{next_expected_id}"
		.then (id)->
			# Add
			{agent_string_1: s, id}.should.deep.equal { agent_string_1: s, id: next_expected_id}
			++next_expected_id

	it 'adds+find_cache', ()->
		s= false
		Promise.resolve()
		.then ->

			# Add
			module.xlate s= agent_string_2+ " ##{next_expected_id}"
		.then (id)->
			{agent_string_2: s, id}.should.deep.equal { agent_string_2: s, id: next_expected_id}

			# Find
			module.xlate s
		.then (id)->
			{agent_string_2: s, id}.should.deep.equal { agent_string_2: s, id: next_expected_id}

			++next_expected_id

	it 'find-db', ()->
		Promise.resolve()
		.then ->
			module.xlate agent_string_3
		.then (id)->
			# Find
			{agent_string_3, id}.should.deep.equal { agent_string_3, id: already_added_id}
			++next_expected_id # Because, finding an existing non-cache entry, will bump the autoincrement primary index

	it 'handles simultaineous updates', ()->
		expected= []
		Promise.resolve()
		.then ->
			#TODO p= Promise.resolve()
			p= []
			for i in [1..20]
				p.push s= module.xlate agent_string_4+ ' #'+ next_expected_id
				expected.push next_expected_id
				p.push s
				expected.push next_expected_id
				++next_expected_id
			Promise.all p
		.then (id_array)->
			# Find
			id_array.should.deep.equal expected

