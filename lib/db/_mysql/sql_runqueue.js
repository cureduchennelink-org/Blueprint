#
#	RunQueue Database Functions
#
#	A RunQueue is a DB backed 'run exactly once' persitent store, indexed to optimize for 'what runs next' polling
#	Is a standalone table (no joins) but other tables may hold 'id's
#
Promise= require 'bluebird'
_= require 'lodash'
it_is= require 'is_js'

class SqlRunQueue
	constructor: (core, kit)->
		@log= kit.services.logger.log
		@E= kit.services.error
		@db= core
		@table= 'runqueue'
		cols=[
			'id', 'di', 'cr', 'mo',
			'unique_key',
			'topic', 'group_ref',
			'in_process', 'priority', 'run_at',
			'retries', 'fail_at', 'last_reason',
			'json',
			]
		@schema=
			AddJob:
				allowed: [
					'unique_key',
					'topic', 'group_ref',
					'priority', 'run_at',
					'json',
					]
				defaults:
					in_process: 0, retries: 0, fail_at: null, last_reason: null,
			ReplaceJob:
				allowed: [ # Cannot change the 'topic' eh? but 'json' is ok I guess.
					'unique_key',
					'priority', 'run_at',
					'json',
					]
				defaults:
					in_process: 0, retries: 0, fail_at: null, last_reason: null,
					unique_key: null,
					json: null
			Fail:
				required: [
					'last_reason', 'run_at',
					]
				defaults:
					in_process: 0, fail_at: null, # These need to be reset (Need to bump retries also)

		@db.method_factory @, 'SqlRunQueue' # TODO NEEDED?

	GetPendingCnts: (ctx)->
		f= "SqlRunQueue:GetPendingCnts:"

		# TODO CONSIDER HOW TO HANDLE FAIL_AT - WHO WILL SEE THESE AND RESTART THEM? WHILE IN_PROCESS=1 *AND* FAIL_AT IN PAST, DO WE STILL COUNT HERE?
		sql= """
			SELECT COUNT(*) active_cnt, group_ref
			FROM #{@table}
			WHERE in_process= 1 AND di= 0
			GROUP BY group_ref
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, []

	GetNextJobs: (ctx, max_rows, max_retries= 8)->
		f= "SqlRunQueue:GetNextJobs:"

		# TODO CHECK ORDER BY RUN_AT (OLDER DATE FIRST) AND PRIORITY (1 before 8)
		# TODO COULD LEAVE DI CHECK OUT IF CALLER WILL REMOVE THOSE LATER? ELSE A JOB REMOVES THEM EVENTUALLY
		sql= """
			SELECT *
			FROM #{@table}
			WHERE in_process= 0 AND run_at< NOW() AND retries< ? AND di= 0
			ORDER BY priority, run_at
			LIMIT ?
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, [ max_retries, max_rows]

	MarkJobPending: (ctx, id, other_values, reread= false)-> # Fails if other_values has nothing
		f= "SqlRunQueue:MarkJobPending:"

		sets= [ 'in_process= ?']
		args= [ 1]
		for nm,val of other_values
			sets.push "#{nm}= ?"
			args.push val
		args.push id
		# When in_process isnt 0, another server got here first, so caller checks 'affectedRows is 1' (means the 'win')
		sql= """
			UPDATE #{@table}
			SET #{sets.join ','}
			WHERE id= ? AND in_process= 0
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, args
		.then (db_result)->
			return db_result unless reread is true # Caller will check for success
			return [] unless db_result.affectedRows is 1

			@db.sqlQuery ctx, "SELECT * FROM #{@table} WHERE ID= ?", [id]

	RemoveByIds: (ctx, ids)->
		f= "SqlRunQueue:RemoveByIds:"
		ids= [ ids] unless it_is.array ids

		sql= """
			UPDATE #{@table}
			SET di= 1
			WHERE id IN (?)
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, [ids]

	RemoveByUniqueIds: (ctx, uniqueIds)->
		f= "SqlRunQueue:RemoveByUniqueIds:"

		uniqueIds= [ ids] unless it_is.array uniqueIds

		sql= """
			UPDATE #{@table}
			SET di= 1
			WHERE unique_id IN (?)
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, uniqueIds

	AddJob: (ctx, new_values, reread= false)->
		f= "SqlRunQueue:AddJob:"
		e= f

		allowed_values= {}
		for nm,val of new_values
			throw new @E.DbError e+"UNKNOWN_COL:#{nm}" unless nm in @schema.AddJob.allowed
			allowed_values[ nm]= val

		values= _.merge {}, @schema.AddJob.defaults, allowed_values
		cols= ['cr']
		vals= ['?']
		args= [null]
		for nm,val of values
			cols.push nm
			vals.push '?'
			args.push val
		sql= """
			INSERT INTO #{@table} ( #{cols} ) VALUES ( #{vals} )
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, args
		.then (db_result)->
			return db_result unless reread is true # Caller will check for sucess
			return [] unless db_result.affectedRows is 1
			id= db_result.insertId

			@db.sqlQuery ctx, "SELECT * FROM #{@table} WHERE ID= ?", [id]

	ReplaceJob: (ctx, id, new_values, reread= false)->
		f= "SqlRunQueue:AddJob:"
		e= f

		allowed_values= {}
		for nm,val of new_values
			throw new @E.DbError e+"UNKNOWN_COL:#{nm}" unless nm in @schema.ReplaceJob.allowed
			allowed_values[ nm]= val

		values= _.merge {}, @schema.ReplaceJob.defaults, allowed_values
		sets= []
		args= []
		for nm,val of values
			sets.push "#{nm}=?"
			args.push val
		args.push id
		sql= """
			UPDATE #{@table}
			SET #{sets}
			WHERE ID= ?
		"""
		Promise.resolve().bind @
		.then ->

			@db.sqlQuery ctx, sql, args
		.then (db_result)->
			return db_result unless reread is true # Caller will check for sucess
			return [] unless db_result.affectedRows is 1

			@db.sqlQuery ctx, "SELECT * FROM #{@table} WHERE ID= ?", [id]

	Fail: (ctx, id, new_values, reread= false)->
		f= "SqlRunQueue:Fail:"
		e= f

		allowed_values= {}
		for nm,val of new_values
			throw new @E.DbError e+"UNKNOWN_COL:#{nm}" unless nm in @schema.Fail.required
		for nm in @schema.Fail.required
			throw new @E.DbError e+"MISSING_COL:#{nm}" unless nm of new_values
			allowed_values[ nm]= new_values[ nm]

		values= _.merge {}, @schema.Fail.defaults, allowed_values
		sets= ['retries= retries+ 1']
		args= []
		for nm,val of values
			sets.push "#{nm}=?"
			args.push val
		args.push id
		sql= """
			UPDATE #{@table}
			SET #{sets}
			WHERE ID= ?
		"""
		Promise.resolve().bind @
		.then ->

			@db.sqlQuery ctx, sql, args
		.then (db_result)->

			return db_result unless reread is true # Caller will check for sucess
			return [] unless db_result.affectedRows is 1

			@db.sqlQuery ctx, "SELECT * FROM #{@table} WHERE ID= ?", [id]

	GetDelayedByTopic: (ctx) ->
		f= "SqlRunQueue:GetDelayedByTopic:"

		sql= """
			SELECT topic, TIMESTAMPDIFF(SECOND,MIN(run_at), NOW()) AS 'delay'
			FROM #{@table}
			WHERE run_at < NOW() and di = 0 and in_process = 0
			GROUP BY topic
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, []

	GetRetriesByTopic: (ctx) ->
		f= "SqlRunQueue:GetRetriesByTopic:"

		sql= """
			SELECT topic, MAX(retries) AS 'max_retries'
			FROM #{@table}
			WHERE di = 0 and retries > 0
			GROUP BY topic
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, []

	GetFailuresByTopic: (ctx) ->
		f= "SqlRunQueue:GetFailuresByTopic:"

		sql= """
			SELECT topic, COUNT(*) AS 'failures'
			FROM #{@table}
			WHERE di = 0 and in_process = 1 and fail_at < NOW()
			GROUP BY topic
		"""
		Promise.resolve().bind @
		.then ->
			@db.sqlQuery ctx, sql, []

exports.SqlRunQueue= SqlRunQueue
