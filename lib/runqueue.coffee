#
#	Service: RunQueue (DB backed, Monolith, Exactly-once, Exponential backoff, Re-ocurring semantics, crash recovery)
#	JCS: Updated to use Sergey's port to MongoDB
#
Promise= require 'bluebird'
_= require 'lodash'
it_is= require 'is_js'
moment= require 'moment'
VALID_UNITS= [ 'months', 'M', 'weeks', 'w', 'days', 'd', 'hours', 'h', 'minutes', 'm', 'seconds', 's', ]

class RunQueue
	@deps=
		services:[ 'config', 'error', ] # Also, FYI, there are dynamic references to services per config.topics
		mysql: ['runqueue']
		config:[
			'runqueue.topic_defaults{back_off,last_fail,priority,external_group,limit,alarm_cnt,warn_cnt,warn_delay,alarm_delay}'
			'runqueue.external_groups[default/ANY{connections,requests}]'
			'runqueue.topics.ANY{call,type,priority,run_at,external_group}'
			'runqueue.settings[poll_interval_ms,jobs,read_depth]'
			'runqueue[mongodb_uri,mongodb_name]'
		]

	constructor: (kit) ->
		f= 'RunQueue::constructor'
		@log= 		kit.services.logger.log
		@E= 		kit.services.error
		@sdb= 		kit.services.db.mysql # TODO: Let's make this a conditional based on what we need. Mongo / MySQL
		@config=	kit.services.config.runqueue

		@ctx_poll= log: @log, conn: false # Poller will populate conn-ection on demand
		@poll_timer_id= false
		@poll_processing= false # To keep from poller running on top of us
		@job_cnt= 0 # Active jobs running on this server; Should not exceed @config.settings.jobs

		@ctx_finish= log: @log, conn: false # Poller will populate on demand
		@finish_promise= Promise.resolve().bind @ # Used to serialize all writes back to the job queue
		@topics= {}
		for nm,rec of @config.topics
			@topics[ nm]= _.merge {nm}, @config.topic_defaults, rec

		@groups= {}
		group_defaults= @config.external_groups[ 'default'] # Quotes for you, John.
		for nm,rec of @config.external_groups when nm isnt 'default'
			@groups[ nm]= _.merge {}, group_defaults, rec

		@log.debug f, {@topics,@groups}

		# Error.name for jobs that violate the unique_key constraint
		@ERR_DUPLICATE_JOB = "DuplicateJobError"

	# These methods return a number of seconds to add to the job time
	_back_off_strategies:
	# The standard back off strategy
		standard: (retries)-> if retries is 0 then 0 else retries^ 4+ 5+ @standard retries- 1

	#Test Strategies
	# One year.  Used to prevent testjobs from re-running
		year: (retries)-> if retries is 0 then 0 else 365 * 24 * 60 * 60
	# Immediately retry.
		immediate: (retries) -> 0

	server_start: (kit)=> # After the services are all created, we need to validate/load our dynamic references per topic
		f= 'RunQueue::server_start:'
		for nm,topic of @topics
			topic.nm= nm
			@log.debug f, {topic}
			[service, method]= topic.service.split '.'
			throw new Error "KIT DOES NOT HAVE SERVICE (#{service}) MENTIONED IN TOPIC (#{nm}) AS [#{topic.service}]" unless service of kit.services
			throw new Error "KIT DOES NOT HAVE BACK OFF STRATEGY IN TOPIC (#{nm})" unless it_is.string topic.back_off
			throw new Error "UNKNOWN BACK OFF STRATEGY #{topic.back_off} IN TOPIC #{nm} should be one of [#{Object.keys(@_back_off_strategies)}]" unless it_is.function @_back_off_strategies[topic.back_off]
			throw new Error "METHOD (#{method}) NOT FOUND IN SERVICE (#{service}) MENTIONED IN TOPIC (#{nm}) AS [#{topic.service}]" unless method of kit.services[ service]
			topic._method= kit.services[ service][ method]
			throw new Error "NOT A FUNCTION: (#{topic.service}) MENTIONED IN TOPIC (#{nm})" unless it_is.function topic._method
			topic.alarm_delay_sec = @_calc_secs topic.alarm_delay, "#{nm}.alarm_delay"
			topic.warn_delay_sec = @_calc_secs topic.warn_delay, "#{nm}.warn_delay"

		interval_ms= @config.settings.poll_interval_ms
		@poll_timer_id= setInterval @_Poll, interval_ms unless interval_ms is false # False for unit-testing
		# TODO FIND A WAY TO DETECT SERVER IS GOING DOWN, AND CANCEL THIS TIMER
		Promise.resolve().bind @
		.then ->

			@sdb.core.Acquire()
		# 09/04/18 CRB: Below is the config for using Mongo
		# @sdb.runqueue.open @config.mongodb_uri, @config.mongodb_name
		.then (c)->
			@ctx_finish.conn= c

	Drain: ->  # Stop taking in new job requests, the server is coming down
		f= 'RunQueue::Drain:'
		@log.info f, {was_draining: @poll_timer_id is false}
		if @poll_timer_id isnt false
			clearInterval @poll_timer_id
			@poll_timer_id= false

	_pick_at: (retries, which, topic, other_object)-> # E.g. 0, 'run_at', topic_as_str_or_@topics[nm], users_object_with_optional_override
		f= 'RunQueue::_pick_at:'
		#@log.debug f, {retries,which,topic,other_object}
		resolved_topic = if it_is.string topic then @topics[ topic] else topic
		if it_is.object(other_object) and other_object[ which]
			# Overridden by either array as [N,S] or expect a date
			at= other_object[ which]
		else
			at= resolved_topic[ which]

		back_off_strategy = resolved_topic['back_off']

		if it_is.array at
			@_calc_at (@_back_off_strategies[back_off_strategy] retries), at, "#{resolved_topic.nm}:#{which}"
		else
			moment( at).format()

	_validate_format: (spec, name) ->
		if (it_is.array spec) and (it_is.number spec[0]) and (it_is.string spec[1]) and spec[ 1] in VALID_UNITS
		then true
		else throw new Error "SPEC (#{name}) WAS NOT AN ARRAY OF NUMBER AND STRING-UNIT (#{spec})"

	_calc_secs: (spec, name) ->
		@_validate_format spec, name
		moment(0).add(spec[0], spec[1]).unix()

	_calc_at: (base, spec, name)->
		@_validate_format spec, name
		moment().add( base, 's').add( spec[ 0], spec[ 1]).format()

	# Details: req'd: {topic:K,json:S} overrides: {priority:I,run_at:[I,S]} optional: {unique_key:S}
	AddJob: (ctx, details, job_id= false)-> # Caller provides promise wrapper (internal, job_id set if 'replace'
		f= 'RunQueue::AddJob:'
		if job_id is false
			for nm in [ 'topic', 'json', ]
				console.log @E.MissingArg nm unless nm of details
				throw @E.MissingArg nm unless nm of details
			throw new @E.InvalidArg "topic (#{details.topic})" unless details.topic of @topics
		topic= @topics[ details.topic]

		defaults= _.pick topic, [ 'priority', 'unique_key'] # User can override these

		only_topics= _.pick topic, [ 'group_ref', ]
		allowed_details= _.pick details, [ 'topic', 'unique_key', 'priority', 'json', ]
		allowed_details.run_at= @_pick_at 0, 'run_at', topic, details

		new_values= _.merge defaults, allowed_details, only_topics

		Promise.resolve().bind @
		.then ->
			if job_id is false
				@sdb.runqueue.AddJob ctx, new_values, reread= true
			else
				replace_values= _.pick new_values, [ # List from sql layer for ReplaceJob
					'unique_key',
					'priority', 'run_at',
					'json',
				]
				@sdb.runqueue.ReplaceJob ctx, job_id, replace_values, reread= true
		.catch (e)->
			if (
				e.errno is 1062 and e.sqlMessage.includes "ix_runqueue__unique_key"
			) or (
				e.code is 11000 and e.errmsg.includes 'duplicate key error collection'
			)
			then e.name = @ERR_DUPLICATE_JOB
			throw e

	RemoveJobsByIds: (ids)->
		f= 'RunQueue::RemoveJobsByIds:'
		@finish_promise= @finish_promise.then ->
			Promise.resolve().bind @
			.then ->
				@sdb.runqueue.RemoveByIds @ctx_finish, ids
			.catch (e)->
				@log.error f, e
		return

	RemoveJobsByUniqueIds: (uniqueIds)->
		f= 'RunQueue::RemoveJobsByUniqueIds:'
		@finish_promise= @finish_promise.then ->
			Promise.resolve().bind @
			.then ->
				@sdb.runqueue.RemoveByExtern @ctx_finish, uniqueIds
			.catch (e)->
				@log.error f, e
		return

	_set_status: (status_obj, status, detail_name, row) ->
		#Red is max, always set it
		#Only set yellow if we are green
		if status is 'r' or status_obj.status is 'g'
			status_obj.status = status

		if status_obj.details[detail_name] is undefined
			status_obj.details[detail_name] = []
		status_obj.details[detail_name].push row

	# Returns a status structure
	# {status: [r|y|g], details: {[delays|retries|failures] : [{topic, <detail>}, ...]}
	HealthCheck: (ctx)->
		f= 'RunQueue::HealthCheck:'
		status = status: 'g', details: {}
		Promise.resolve().bind @
		.then ->
			@sdb.runqueue.GetDelayedByTopic ctx
		.then (result)->
			for row in result
				topic = @topics[row.topic]
				if row.delay >= topic.alarm_delay_sec
					@_set_status status, 'r', 'delays', row
				else if row.delay >= topic.warn_delay_sec
					@_set_status status, 'y', 'delays', row

			@sdb.runqueue.GetRetriesByTopic ctx
		.then (result)->
			for row in result
				topic = @topics[row.topic]
				if row.max_retries >= topic.alarm_cnt
					@_set_status status, 'r', 'retries', row
				else if row.max_retries >= topic.warn_cnt
					@_set_status status, 'y', 'retries', row

			@sdb.runqueue.GetFailuresByTopic ctx
		.then (result)->
			if (!it_is.empty result)
				# Go right to code red
				status.status = 'r'
				status.details.failures = result

			status

	# Get at most settings.read_depth jobs,
	#   and spawn them up to the connection limit on the group, not to exceed our own settings.jobs
	_Poll: =>
		f= 'RunQueue::_Poll:'
		rVal= [] # Returned to caller for testing (when unit tests call us directly)
		@log.debug f, {@poll_processing, @job_cnt}
		return stop: 'poll_processing' if @poll_processing is true
		@poll_processing= true
		# Note: Assumes catastrophic errors only when server crashes
		return stop: 'job_cnt' if @job_cnt> @config.settings.jobs # We are still over our local max outstanding jobs
		ctx= @ctx_poll
		job= false

		group_cnt= {} # Don't exceed these counts
		group_cnt[ nm]= rec.connections for nm,rec of @groups

		Promise.resolve().bind @
		.then ->
			return false unless ctx.conn is false
			rVal.push step: 'acquire'
			@sdb.core.Acquire()
		# @sdb.runqueue.open @config.mongodb_uri, @config.mongodb_name
		.then (c)->
			ctx.conn= c unless c is false

			# Adjust group_cnt by currently running jobs (for all servers i.e. using DB)
			rVal.push pre_group_cnt: _.clone group_cnt
			@sdb.runqueue.GetPendingCnts ctx
		.then (db_rows)->
			group_cnt[ rec.group_ref]-= rec.active_cnt for rec in db_rows
			rVal.push post_group_cnt: _.clone group_cnt

			@sdb.runqueue.GetNextJobs ctx, @config.settings.read_depth
		.then (db_rows)->
			rVal.push next_jobs: db_rows
			if db_rows.length is 0 # No work in this block
				@poll_processing= false
				return false

			q_result= Promise.resolve().bind @
			for job in db_rows
				continue if group_cnt[ job.group_ref]< 1
				group_cnt[ job.group_ref]-- # Someone will run this, or we will
				do (job)=>
					# We have to fight for the right to run this job
					q_result= q_result # Serialize behind one promise for this poll interval
					.then ->
						fail_at= @_calc_at 0, @topics[ job.topic].fail_at, job.topic+ '.fail_at' # COULD THROW ERROR AND NOT PROCESS REST OF JOBS!
						@sdb.runqueue.MarkJobPending ctx, job.id, {fail_at}, reread= true
					.then (db_rows)->
						rVal.push MarkJobPending_result: db_rows
						return [false] if db_rows.length isnt 1

						# Wrap in a promise and catch error as a topic_result w/failure setting
						Promise.resolve().bind @
						.then ->
							@topics[ job.topic]._method job
						.then (topic_result)->
							rVal.push topic_method_result: topic_result
							[job, topic_result]
						.catch (e)->
							rVal.push topic_method_error: e
							[job, error: e]

					.then ([job, topic_result])->
						return false if job is false # Some other server ran it first

						@_ProcessTopicResult job, topic_result
					.then (process_result)->
						rVal.push {process_result}

			@poll_processing= false # Allow a new poll request, even though the promise-chain of 'attempt to mark-n-lauch jobs' is only just established
			q_result # If we didn't return this, we would not have to actually wait for these things to finish. Consider global promise per group?
		.then ->
			rVal

	# Topic-result can be 3 possible things
	# (a) Remove the job when done
	# (b) Re-schedule job fresh (as retries=0)
	# (c) Failure, so mark as such to try again later
	_ProcessTopicResult: (job, topic_result)->
		f= 'RunQueue::_ProcessTopicResult:'
		ctx= @ctx_finish

		@log.debug f+'BEFORE', {topic_result}
		if 'error' of topic_result # Caught error from running their logic
			topic_result= success: false, reason: topic_result.error?.stack ? topic_result.error.toString()
		else if 'success' not of topic_result
			topic_result= success: false, reason: "Bad Response: "+ JSON.stringify topic_result
		@log.debug f+'AFTER', {topic_result}

		@finish_promise= @finish_promise
		.then ->
			Promise.resolve().bind @
			.then ->
				if topic_result.success is true # Else we consider it a failure
					if topic_result.replace # Replace with a fresh job in-place
						# Json can change or not, but topic currently won't be replaced by the sql layer, but AddJob wants it
						#new_values= _.merge { json: job.json, }, topic_result.replace,{ topic: job.topic, }
						new_values= _.merge { topic: job.topic, }, topic_result.replace # Allow topic override, but know sql won't change it
						# TODO new_values= topic_result.replace
						@AddJob ctx, new_values, job.id # Job.id on end does a replace
					else
						@sdb.runqueue.RemoveByIds ctx, job.id
				else
					run_at= @_pick_at job.retries+ 1, 'run_at', job.topic, topic_result
					@sdb.runqueue.Fail ctx, job.id, {run_at, last_reason: topic_result.reason}, reread= true
			.catch (err)->
				@log.error f, {job,topic_result,err}
				err # TODO CONSIDER WHAT IMPACT RETURNING AN ERROR HERE HAS ON THE REST OF THE PROMISE CHAIN

exports.RunQueue= RunQueue
