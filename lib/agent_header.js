#
#	Agent header parse/store service (Keep unique ID for long ugly strings)
#	TODO: DETERMINE IF WE NEED TO MAKE ONE LARGER PROMISE HERE, TO SERIALIZE OUR COMMON DB CONNECTION
#


Promise= require 'bluebird'
parse= require 'user-agent-parser'

class AgentHeader
	@deps: services: ['logger' ,'config' ], mysql: [ 'agent_header'], config: 'agent_header[count_max]'
	constructor: (kit) ->
		@log= kit.services.logger.log
		config= kit.services.config.agent_header
		@sdb= kit.services.db.mysql
		@ctx= log: @log, conn: false
		@count_max= config?.count_max ? 200
		@memcache= {} # For speed, hold onto strings we've encountered since startup (yields the id)
		@memcache_count= 0 # Bump this, and when it hits the configured max, just forget everything and start again

	server_start: (kit)=> # After the services are all created, we need to validate/load our dynamic references per topic
		f= 'AgentHeader::server_start:'

		Promise.resolve().bind @
		.then ->

			@sdb.core.Acquire()
		.then (c)->
			@ctx.conn= c

	# Converts (translates) a long ugly string to a short ID
	# TODO COULD ADD THE X-DV-VERSION STRING, SPLIT ON TILDE - OR COULD MAKE THIS ANOTHER METHOD TO XLATE TO AN ID MAYBE
	xlate: (agent_header_string)->
		f= 'lib/AgentHeader.store'
		@log.debug f, {agent_header_string}
		# Someone has a string on an inbound endpoint request; try to quickly process it
		# only if brand new should we parse it and store all the details
		id= @memcache[ agent_header_string] # 'id' in the closure, will be returned eventually
		return id if id? # Nice, it was cached
		# Could be in the DB, so check there next
		Promise.resolve().bind @
		.then ->

			# Store in db (if not already there) and get ID
			more= {}
			for nm,rec of parse agent_header_string
				more[ "#{nm}_#{sub_nm}"]= val for sub_nm,val of rec
			@sdb.agent_header.InsertIfNew @ctx, agent_header_string, more
		.then (db_results)->
			# TODO IS THIS ALLOWED TO FAIL?
			id= db_results.insertId
			@_add agent_header_string, id

		.then -> id

	_add: (agent_header_string, id)->
		if @memcache_count> @count_max
			@memcache_count= 0
			@memcache= {}
		@memcache[ agent_header_string]= id

exports.AgentHeader= AgentHeader
