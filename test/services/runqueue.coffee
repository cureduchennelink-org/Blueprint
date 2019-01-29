#
#	RunQueue Service Tests
#	JCS: Modified for Mongo/Mongoose port by Sergey
#
#	Notes: For testing on epic server environment, do:
#	(in node_modules: $ ln -s .. blueprint)
#	[JCS RUN SQL NOT NEEDED FOR MONGODB, BUT MAY NEED TO DROP THE COLLECTION AT TIMES]
#	NODE_ENV=development npm_config_mongodb_uri=mongodb://localhost npm_config_mongodb_name=test npm run test-s-runqueue
#
Promise= require 'bluebird'
moment= require 'moment-timezone'
chai= require 'chai'
#Db= require '../lib/db'
Mdb= require '../lib/mongo_db'
server= require '../../'
config= require '../config'
it_is= 	is_it= require 'is_js'
_= require 'lodash'
_log= console.log
mongodb_uri= (process.env.npm_config_mongodb_uri ? "mongodb://localhost")
mongodb_name= (process.env.npm_config_mongodb_name ? "test")
mongodb_url= mongodb_uri+ '/'+ mongodb_name

showme= (obj)->
	console.log 'SHOWME:'+ typeof obj,
		keys: Object.keys obj
		funcs: (nm for nm,val of obj when typeof val is 'function')
		name: obj.constructor?.name ? 'no-name'

chai.should()		# Should Expectation Library
mydb= false
clean_db_jobs= (db_rows)->
	for job in db_rows
		delete job.id
		delete job.cr
		delete job.mo
		job.run_at=  if job.run_at then moment( job.run_at).format() else null
		job.fail_at= if job.fail_at then moment( job.fail_at).format() else null
		job.last_reason= null if not job.last_reason

clean_poll_result= (result, debug= false)-> # Could be array of lines of jobs, or array of jobs
	f= 'TEST::clean_poll_request:'
	_log f, {result} if debug
	return unless it_is.array result
	for line in result
		_log f, {line} if debug
		if it_is.array ary=( line.next_jobs or line.process_result or line.MarkJobPending_result )
			_log f+'DB', {ary} if debug
			clean_db_jobs ary
		else
			for obj_key in [ 'process_result' ]
				_log f+'OBJ?', o: line[ obj_key], t: typeof line[ obj_key]?.affectedRows if debug
				if (it_is.object line[ obj_key]) and (it_is.number line[ obj_key].affectedRows)
					line[ obj_key]= _.pick line[ obj_key], [ 'affectedRows']
					_log f+'OBJ', o: line[ obj_key] if debug

describe 'RunQueue: ', ()->

	before ->
		Promise.resolve()
		.then ->
			Mdb.Instance mongodb_url
		.then (result)->
			mydb= result

	jobs_to_expect_at_the_end= []

	#These variables are used to uniquely identify jobs we created
	unique= 'TESTABILITY_101'
	unique_json= JSON.stringify {unique}
	health_check_json = JSON.stringify({health_check: 101})

	dash_id_1= 99099
	userA= config.auth_runqueue
	rq_max= 1000* 1000
	base_group_cnt=
		SampleTest: rq_max, SES: rq_max, GenericService: 2

	fail_default=[ 5, 'm']
	base_job_result=
		my_test_topic:
			di: 0, unique_key: null, fail_at: null, group_ref: 'SET-ME', in_process: 0, json: unique_json
			last_reason: null, priority: 350, retries: 0
		topic_success:
			di: 0, unique_key: 'topic_success', fail_at: null, group_ref: 'SET-ME', in_process: 0, json: unique_json
			last_reason: null, priority: 300, retries: 0
		topic_fail:
			di: 0, unique_key: 'topic_fail', fail_at: null, group_ref: 'Mock', in_process: 0, json: unique_json
			last_reason: null, priority: 300, retries: 0

	runqueue_service= false # The service instance under test
	ctx= {}

	cleanup= ()->
		_log 'Cleaning Up...'
		expected_in_db= {}
		
		Promise.resolve()
		.then ->
			# [MySQL] db.SqlQuery 'DELETE FROM runqueue WHERE json LIKE ? OR json = ?', ['%'+ unique+ '%', health_check_json]
			# As it stands, this function removes every record inside of a collection.
			# That is different than the MySQL query.
			mydb.runqueue.remove({})

	


	describe '_Poll/init: ', ()->
		
		before ()->
			f= 'before'
			# Sometimes a failure leaves things not-cleaned-up
			# CONSIDER PUTTING SEVERAL JOBS IN VARIOUS STATES, INTO THE QUEUE (MAYBE IN A SEPARATE DESCRIBE, EH?)
			cleanup()

			.then ()->
				config_overrides=
					runqueue: {mongodb_uri, mongodb_name}
					service_modules:
						GenericService:		class: 'GenericService',		file: './test/lib/generic_runqueue_service'
						RunQueue:				file: './lib/runqueue'
				kit_overrides=
					services: config: runqueue:
						topics:
							my_test_topic:
								service: 'GenericService.Repeat', type: 'per-user,reoccur,fanout'
								priority: 350, run_at: [5,'s'], group_ref: 'SampleTest'
							topic_success:
								service: 'GenericService.Success', type: 'per-user', priority: 300,
								run_at: [0,'s'], group_ref: 'GenericService', unique_key: 'topic_success' # There can only be one topic_success
							topic_fail:
								service: 'GenericService.Fail', type: 'per-user', priority: 300,
								run_at: [0,'s'], group_ref: 'GenericService', unique_key: 'topic_fail', back_off: 'year'
							# These must be stubbed, so runqueue won't expect the PkiSvcAws pacakge to be loaded
							poll__aws__make_cert_for_slot: service: 'GenericService.Fail'
							order__aws__make_cert_for_slot: service: 'GenericService.Fail'
							device__aws__make_cert_for_slot: service: 'GenericService.Fail'
						external_groups:
							GenericService:
								connections: 2
				server.start false,[ 'RunQueue', 'GenericService', ],[ ], false,[ ], false, config_overrides, kit_overrides
			.then (kit)->
				ctx.log= kit.services.logger.log
				runqueue_service= kit.services.RunQueue # TODO: Need to pull this before logic out and into the parent describe

		after ()->
			_log '### TEST COMPLETE ###'
			# TODO PUT THIS BACK IF DESIRED. cleanup()

		it '_Poll with no jobs', ->
			Promise.resolve()
			.then ->
				runqueue_service._Poll()
			.then (result)->
				result.should.deep.equal [
					{ step: "acquire" }
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt: base_group_cnt }
					{ next_jobs: [] }
				]

	describe 'AddJob sad paths: ', ->

		# Job Details: req'd: {topic:K,json:S} overrides: {priority:I,run_at:[I,S]}
		it 'Needs a topic', ->
			payload= Xtopic: 'Xalert_tropo', Xjson: unique_json
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				result.should.deep.equal SUPPOSED: "TO BREAK"
			.catch (result)->
				_log {result}
				result.body.should.deep.equal error: 'MissingArg', message: 'topic'

		it 'Needs a json', ->
			payload= topic: 'Xalert_tropo', Xjson: unique_json
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				result.should.deep.equal SUPPOSED: "TO BREAK"
			.catch (result)->
				_log {result}
				result.body.should.deep.equal error: 'MissingArg', message: 'json'

		it 'Needs a valid topic', ->
			payload= topic: 'Xalert_tropo', json: unique_json
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				result.should.deep.equal SUPPOSED: "TO BREAK"
			.catch (result)->
				_log {result}
				result.body.should.deep.equal error: 'InvalidArg', message: "topic (#{payload.topic})"

		it 'Add topic_fails', ->
			payload= topic: 'topic_fail', json: unique_json
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				group_ref= 'GenericService'
				run_at= moment().add(0,'s').format()
				job= _.merge base_job_result[ 'topic_fail'], payload, {run_at, group_ref}
				clean_db_jobs result
				showme result
				result.should.deep.equal [job]

		it '_Poll topic_fails', ->
			Promise.resolve()
			.delay 1000 # Wait a second, because the poller won't pick up until run_at of 0,secs is in the past
			.then ->
				runqueue_service._Poll()
			.then (result)->
				result.should.be.an('array').that.has.a.lengthOf 6
				result[4].should.have.a.property('topic_method_error').that.is.an.instanceOf(Error)
				error = result[4].topic_method_error
				jobs_to_expect_at_the_end.push _.merge {}, base_job_result['topic_fail'], last_reason: error.toString(), retries: 1, run_at: moment(result[5].process_result[0].run_at).format()

	describe 'AddJob topic_success HAPPY path: ', ->
		topic= 'topic_success'
		group_ref= 'GenericService'
		run_at= false

		it 'Just topic and json', ->
			payload= {topic, json: unique_json}
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				run_at= moment().add(0,'s').format()
				job= _.merge base_job_result[ topic], payload, {run_at, group_ref}
				dbcr= result[0].cr
				clean_db_jobs result
				result.should.deep.equal [job]
				(dbcr?.constructor?.name).should.equal "Date"
				moment(dbcr).format().should.equal moment().format()

		it 'Just topic and json duplicate', ->
			# There can only be one topic_success because the config sets the unique_key
			payload= {topic, json: unique_json}
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				throw Error "DUPLICATE JOB CREATED!!! " + topic
			.catch (e)->
				console.log e
				e.name.should.equal runqueue_service.ERR_DUPLICATE_JOB

		it 'Add jobs to exceed the group_ref limit', ->
			payload1= {topic, json: unique_json, unique_key: 'topic_success_1'}
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload1
			.then (result)->
				payload2= {topic, json: unique_json, unique_key: 'topic_success_2'}
				runqueue_service.AddJob ctx, payload2

		it '_Poll the jobs', ->
			job= _.merge base_job_result[ topic], {topic, run_at}
			job1 = _.merge {}, job, unique_key: 'topic_success_1'
			job2 = _.merge {}, job, unique_key: 'topic_success_2'
			Promise.delay(1000) # Wait a second, because the poller won't pick up until run_at of 0,secs is in the past
			.then ->
				runqueue_service._Poll()
			.then (result)->
				job_active= _.merge (_.clone job), in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()
				job1_active= _.merge (_.clone job1), in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()
				clean_poll_result result, true

				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt: base_group_cnt }
					{ next_jobs: [ job, job1, job2 ] }

					# Each job executed creates this triplet
					# Job 0
					{ MarkJobPending_result: [ job_active ] }
					{ topic_method_result: success: true }
					{ process_result: affectedRows: 1 } # Removed result

					# Job 1
					{ MarkJobPending_result: [ job1_active ] }
					{ topic_method_result: success: true }
					{ process_result: affectedRows: 1 } # Removed result
		
				]
				jobs_to_expect_at_the_end.push _.merge (_.clone job_active), di: 1
				jobs_to_expect_at_the_end.push _.merge (_.clone job1_active), di: 1

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

		it '_Poll for the job throttled by group_ref', ->
			job= _.merge base_job_result[ topic], {topic, run_at}
			job2 = _.merge {}, job, unique_key: 'topic_success_2'
			Promise.delay( 1000) # Wait a second, because the poller won't pick up until run_at of 0,secs is in the past
			.then ->
				runqueue_service._Poll()
			.then (result)->
				job2_active= _.merge (_.clone job2), in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()
				clean_poll_result result, true
				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt: base_group_cnt }
					{ next_jobs: [ job2 ] }

					# Job 2
					{ MarkJobPending_result: [ job2_active ] }
					{ topic_method_result: success: true }
					{ process_result: affectedRows: 1 } # Removed result
				]
				jobs_to_expect_at_the_end.push _.merge (_.clone job2_active), di: 1

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

		it '_Poll the job quickly after polling it once. (Job should be processed and gone)', ->
			post_group_cnt= _.clone base_group_cnt
			#post_group_cnt[ group_ref]--
			Promise.resolve()
			.then ->
				runqueue_service._Poll()
			.then (result)->
				clean_poll_result result
				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt }
					{ next_jobs:[ ] }
				]

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

		it '_Poll the job after success/remove (should be no jobs in the queue)', ->
			post_group_cnt= _.clone base_group_cnt
			# SHOULD BE GONE, YES? post_group_cnt[ group_ref]--
			Promise.delay( 1000) # Give little time for the response from the job-function writes to the DB
			.then ->
				runqueue_service._Poll()
			.then (result)->
				clean_poll_result result
				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt }
					{ next_jobs:[ ] }
				]

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

	describe 'AddJob my_test_topic HAPPY path: ', ->
		topic= 'my_test_topic'
		group_ref= 'SampleTest'
		run_at= false

		it 'Topic, json, and run_at', ->
			payload= {topic, json: unique_json, run_at: [1,'s']}
			Promise.resolve()
			.then ->
				runqueue_service.AddJob ctx, payload
			.then (result)->
				run_at= moment().add(1,'s').format()
				job= _.merge base_job_result[ topic], payload, {run_at, group_ref}
				clean_db_jobs result
				result.should.deep.equal [job]

		it '_Poll the job before it is ready to run (no jobs)', ->
			job= _.merge base_job_result[ topic], {topic, run_at}
			Promise.delay( 250) # Wait less than a second
			.then ->
				runqueue_service._Poll()
			.then (result)->
				clean_poll_result result
				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt: base_group_cnt }
					{ next_jobs: [ ] }
				]

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

		it '_Poll the job when it is ready', ->
			f= 'Poll the job when it is ready>>>>'
			job= _.merge base_job_result[ topic], {topic, run_at}
			post_group_cnt= _.clone base_group_cnt
			# NOT YET, JOB IS NOT RUNNING; post_group_cnt[ group_ref]--
			Promise.delay( 2000) # Wait a bit, because the poller won't pick up until run_at of 0,secs is in the past
			.then ->
				runqueue_service._Poll()
			.then (result)->
				_log f, result
				job_active= _.merge (_.clone job), in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()
				replace= run_at: [ 20, 's'], json: job.json
				job_replace= _.merge (_.clone job), run_at: moment().add( 20, 's').format()
				clean_poll_result result
				expected_result= [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt }
					{ next_jobs: [ job ] }
					{ MarkJobPending_result: [ job_active ] }
					{ topic_method_result: success: true, replace: replace }
					{ process_result: [ job_replace ] } # Job put back onto queue
				]
				result.should.deep.equal expected_result
				jobs_to_expect_at_the_end.push _.merge (_.clone job_replace), {} # Any changes?

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

		it '_Poll the job quickly after polling it once. (expect to see the rescheduled job, and group not active)', ->
			post_group_cnt= _.clone base_group_cnt
			# JOB IS NOT ACTIVE post_group_cnt[ group_ref]--
			Promise.resolve()
			.then ->
				runqueue_service._Poll()
			.then (result)->
				clean_poll_result result
				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt }
					{ next_jobs:[ ] }
				]

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

		it '_Poll the job after success/remove (should be no waiting jobs for 20 seconds)', ->
			post_group_cnt= _.clone base_group_cnt
			# NONE ACTIVE post_group_cnt[ group_ref]--
			Promise.delay( 1000) # Give little time for the response from the job-function writes to the DB
			.then ->
				runqueue_service._Poll()
			.then (result)->
				clean_poll_result result
				result.should.deep.equal [
					{ pre_group_cnt: base_group_cnt }
					{ post_group_cnt }
					{ next_jobs:[ ] }
				]

			.catch (result)->
				_log result
				if result.body
					result.body.should.deep.equal {}
				throw result

	describe 'test HealthCheck', ->
		topic = 'topic_success'
		expected = {status: 'g', details: {}}

		it 'Everything is OK', ->
			Promise.resolve()
			.then ->
				runqueue_service.HealthCheck ctx
			.then (result)->
				result.should.deep.equal expected

		it 'Topic is delayed', ->
			Promise.resolve()
			.then ->
				payload = _.merge {}, topic: topic , run_at: [-4, 'm'], json: health_check_json, unique_key: 'HealthCheck_delayed'
				runqueue_service.AddJob ctx, payload
			.then ->
				runqueue_service.HealthCheck ctx
			.then (result)->
				#Hack to deal with timing issues
				delay = result.details.delays[0].delay
				delay.should.be.above(239)
				expected.status = 'y'
				expected.details.delays = [{topic, delay}]
				result.should.deep.equal expected

		it 'Topic has retries', ->
			expected_retries = 4

			Promise.resolve()
			.then ->
				payload = _.merge {}, topic: topic , run_at: [0, 's'], json: health_check_json, unique_key: 'HealthCheck_retried'
				runqueue_service.AddJob ctx, payload
			.then (job) ->
				values = last_reason: 'forced fail', run_at: moment().format()
				fail_promises = (runqueue_service.sdb.runqueue.Fail ctx, job[0].id, values for [1..expected_retries])

				Promise.all fail_promises
			.then ->
				#Update the expected with the new error
				expected.details.retries = [{topic, max_retries: expected_retries}]
				runqueue_service.HealthCheck ctx
			.then (result)->
				result.details.retries.should.deep.equal expected.details.retries

		it 'Topic has failures (timeout)', ->
			Promise.resolve()
			.delay(1000)
			.then ->
				payload = _.merge {}, topic: topic , run_at: [0, 's'], json: health_check_json, unique_key: 'HealthCheck_failure'
				runqueue_service.AddJob ctx, payload
			.then (job) ->
				fail_at = moment().add(0, 's').format()
				runqueue_service.sdb.runqueue.MarkJobPending ctx, job[0].id, {fail_at}
			.then ->
				#Update the expected with the new error
				expected.status = 'r'
				expected.details.failures = [{topic, failures: 1}]
				runqueue_service.HealthCheck ctx
			.then (result)->
				result.details.failures.should.deep.equal expected.details.failures

	describe 'Finalize, query for expected jobs in DB: ', ->
		topic= 'my_test_topic'
		group_ref= 'SampleTest'
		run_at= false

		it 'Only the jobs we expect', ->
			Promise.resolve()
			.then ->
				mydb.runqueue.find({ json: { $nin: [health_check_json] } })
				.toArray((err, result)->
					if err throw err
				 	result.should.deep.equal jobs_to_expect_at_the_end)
