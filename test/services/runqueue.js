/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	RunQueue Service Tests
//	JCS: Modified for Mongo/Mongoose port by Sergey
//
//	Notes: For testing on epic server environment, do:
//	(in node_modules: $ ln -s .. blueprint)
//	[JCS RUN SQL NOT NEEDED FOR MONGODB, BUT MAY NEED TO DROP THE COLLECTION AT TIMES]
//	NODE_ENV=development npm_config_mongodb_uri=mongodb://localhost npm_config_mongodb_name=test npm run test-s-runqueue
//
let is_it;
const Promise= require('bluebird');
const moment= require('moment-timezone');
const chai= require('chai');
//Db= require '../lib/db'
const Mdb= require('../lib/mongo_db');
const server= require('../../');
const config= require('../config');
const it_is= 	(is_it= require('is_js'));
const _= require('lodash');
const _log= console.log;
const mongodb_uri= (process.env.npm_config_mongodb_uri != null ? process.env.npm_config_mongodb_uri : "mongodb://localhost");
const mongodb_name= (process.env.npm_config_mongodb_name != null ? process.env.npm_config_mongodb_name : "test");
const mongodb_url= mongodb_uri+ '/'+ mongodb_name;

const showme= obj => console.log('SHOWME:'+ typeof obj, {
    keys: Object.keys(obj),
    funcs: (((() => {
        const result = [];
        for (let nm in obj) {
            const val = obj[nm];
            if (typeof val === 'function') {
                result.push(nm);
            }
        }
        return result;
    })())),
    name: (obj.constructor != null ? obj.constructor.name : undefined) != null ? (obj.constructor != null ? obj.constructor.name : undefined) : 'no-name'
}
);

chai.should();		// Should Expectation Library
let mydb= false;
const clean_db_jobs= db_rows => (() => {
    const result = [];
    for (let job of Array.from(db_rows)) {
        delete job.id;
        delete job.cr;
        delete job.mo;
        job.run_at=  job.run_at ? moment( job.run_at).format() : null;
        job.fail_at= job.fail_at ? moment( job.fail_at).format() : null;
        if (!job.last_reason) { result.push(job.last_reason= null); } else {
            result.push(undefined);
        }
    }
    return result;
})();

const clean_poll_result= function(result, debug){ // Could be array of lines of jobs, or array of jobs
	if (debug == null) { debug = false; }
	const f= 'TEST::clean_poll_request:';
	if (debug) { _log(f, {result}); }
	if (!it_is.array(result)) { return; }
	return (() => {
		const result1 = [];
		for (var line of Array.from(result)) {
			var ary;
			if (debug) { _log(f, {line}); }
			if (it_is.array(ary=( line.next_jobs || line.process_result || line.MarkJobPending_result ))) {
				if (debug) { _log(f+'DB', {ary}); }
				result1.push(clean_db_jobs(ary));
			} else {
				result1.push((() => {
					const result2 = [];
					for (let obj_key of [ 'process_result' ]) {
						if (debug) { _log(f+'OBJ?', {o: line[ obj_key], t: typeof (line[ obj_key] != null ? line[ obj_key].affectedRows : undefined)}); }
						if ((it_is.object(line[ obj_key])) && (it_is.number(line[ obj_key].affectedRows))) {
							line[ obj_key]= _.pick(line[ obj_key], [ 'affectedRows']);
							if (debug) { result2.push(_log(f+'OBJ', {o: line[ obj_key]})); } else {
								result2.push(undefined);
							}
						} else {
							result2.push(undefined);
						}
					}
					return result2;
				})());
			}
		}
		return result1;
	})();
};

describe('RunQueue: ', function(){

	before(() => Promise.resolve()
    .then(() => Mdb.Instance(mongodb_url)).then(result => mydb= result));

	const jobs_to_expect_at_the_end= [];

	//These variables are used to uniquely identify jobs we created
	const unique= 'TESTABILITY_101';
	const unique_json= JSON.stringify({unique});
	const health_check_json = JSON.stringify({health_check: 101});

	const dash_id_1= 99099;
	const userA= config.auth_runqueue;
	const rq_max= 1000* 1000;
	const base_group_cnt=
		{SampleTest: rq_max, SES: rq_max, GenericService: 2};

	const fail_default=[ 5, 'm'];
	const base_job_result= {
		my_test_topic: {
			di: 0, unique_key: null, fail_at: null, group_ref: 'SET-ME', in_process: 0, json: unique_json,
			last_reason: null, priority: 350, retries: 0
		},
		topic_success: {
			di: 0, unique_key: 'topic_success', fail_at: null, group_ref: 'SET-ME', in_process: 0, json: unique_json,
			last_reason: null, priority: 300, retries: 0
		},
		topic_fail: {
			di: 0, unique_key: 'topic_fail', fail_at: null, group_ref: 'Mock', in_process: 0, json: unique_json,
			last_reason: null, priority: 300, retries: 0
		}
	};

	let runqueue_service= false; // The service instance under test
	const ctx= {};

	const cleanup= function(){
		_log('Cleaning Up...');
		const expected_in_db= {};
		
		return Promise.resolve()
		.then(() => // [MySQL] db.SqlQuery 'DELETE FROM runqueue WHERE json LIKE ? OR json = ?', ['%'+ unique+ '%', health_check_json]
        // As it stands, this function removes every record inside of a collection.
        // That is different than the MySQL query.
        mydb.runqueue.remove({}));
	};

	


	describe('_Poll/init: ', function(){
		
		before(function(){
			const f= 'before';
			// Sometimes a failure leaves things not-cleaned-up
			// CONSIDER PUTTING SEVERAL JOBS IN VARIOUS STATES, INTO THE QUEUE (MAYBE IN A SEPARATE DESCRIBE, EH?)
			return cleanup()

			.then(function(){
				const config_overrides= {
					runqueue: {mongodb_uri, mongodb_name},
					service_modules: {
						GenericService: {		class: 'GenericService',		file: './test/lib/generic_runqueue_service'
					},
						RunQueue: {				file: './lib/runqueue'
					}
					}
				};
				const kit_overrides= {
					services: { config: { runqueue: {
						topics: {
							my_test_topic: {
								service: 'GenericService.Repeat', type: 'per-user,reoccur,fanout',
								priority: 350, run_at: [5,'s'], group_ref: 'SampleTest'
							},
							topic_success: {
								service: 'GenericService.Success', type: 'per-user', priority: 300,
								run_at: [0,'s'], group_ref: 'GenericService', unique_key: 'topic_success'
							}, // There can only be one topic_success
							topic_fail: {
								service: 'GenericService.Fail', type: 'per-user', priority: 300,
								run_at: [0,'s'], group_ref: 'GenericService', unique_key: 'topic_fail', back_off: 'year'
							},
							// These must be stubbed, so runqueue won't expect the PkiSvcAws pacakge to be loaded
							poll__aws__make_cert_for_slot: { service: 'GenericService.Fail'
						},
							order__aws__make_cert_for_slot: { service: 'GenericService.Fail'
						},
							device__aws__make_cert_for_slot: { service: 'GenericService.Fail'
						}
						},
						external_groups: {
							GenericService: {
								connections: 2
							}
						}
					}
				}
				}
				};
				return server.start(false,[ 'RunQueue', 'GenericService', ],[ ], false,[ ], false, config_overrides, kit_overrides);}).then(function(kit){
				ctx.log= kit.services.logger.log;
				return runqueue_service= kit.services.RunQueue;
			});
		}); // TODO: Need to pull this before logic out and into the parent describe

		after(() => _log('### TEST COMPLETE ###'));
			// TODO PUT THIS BACK IF DESIRED. cleanup()

		return it('_Poll with no jobs', () => Promise.resolve()
        .then(() => runqueue_service._Poll()).then(result => result.should.deep.equal([
            { step: "acquire" },
            { pre_group_cnt: base_group_cnt },
            { post_group_cnt: base_group_cnt },
            { next_jobs: [] }
        ])));
});

	describe('AddJob sad paths: ', function() {

		// Job Details: req'd: {topic:K,json:S} overrides: {priority:I,run_at:[I,S]}
		it('Needs a topic', function() {
			const payload= {Xtopic: 'Xalert_tropo', Xjson: unique_json};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(result => result.should.deep.equal({SUPPOSED: "TO BREAK"})).catch(function(result){
				_log({result});
				return result.body.should.deep.equal({error: 'MissingArg', message: 'topic'});
			});
		});

		it('Needs a json', function() {
			const payload= {topic: 'Xalert_tropo', Xjson: unique_json};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(result => result.should.deep.equal({SUPPOSED: "TO BREAK"})).catch(function(result){
				_log({result});
				return result.body.should.deep.equal({error: 'MissingArg', message: 'json'});
			});
		});

		it('Needs a valid topic', function() {
			const payload= {topic: 'Xalert_tropo', json: unique_json};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(result => result.should.deep.equal({SUPPOSED: "TO BREAK"})).catch(function(result){
				_log({result});
				return result.body.should.deep.equal({error: 'InvalidArg', message: `topic (${payload.topic})`});
			});
		});

		it('Add topic_fails', function() {
			const payload= {topic: 'topic_fail', json: unique_json};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(function(result){
				const group_ref= 'GenericService';
				const run_at= moment().add(0,'s').format();
				const job= _.merge(base_job_result[ 'topic_fail'], payload, {run_at, group_ref});
				clean_db_jobs(result);
				showme(result);
				return result.should.deep.equal([job]);});
	});

		return it('_Poll topic_fails', () => Promise.resolve()
        .delay(1000) // Wait a second, because the poller won't pick up until run_at of 0,secs is in the past
        .then(() => runqueue_service._Poll()).then(function(result){
            result.should.be.an('array').that.has.a.lengthOf(6);
            result[4].should.have.a.property('topic_method_error').that.is.an.instanceOf(Error);
            const error = result[4].topic_method_error;
            return jobs_to_expect_at_the_end.push(_.merge({}, base_job_result['topic_fail'], {last_reason: error.toString(), retries: 1, run_at: moment(result[5].process_result[0].run_at).format()}));
        }));
	});

	describe('AddJob topic_success HAPPY path: ', function() {
		const topic= 'topic_success';
		const group_ref= 'GenericService';
		let run_at= false;

		it('Just topic and json', function() {
			const payload= {topic, json: unique_json};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(function(result){
				run_at= moment().add(0,'s').format();
				const job= _.merge(base_job_result[ topic], payload, {run_at, group_ref});
				const dbcr= result[0].cr;
				clean_db_jobs(result);
				result.should.deep.equal([job]);
				(__guard__(dbcr != null ? dbcr.constructor : undefined, x => x.name)).should.equal("Date");
				return moment(dbcr).format().should.equal(moment().format());
			});
		});

		it('Just topic and json duplicate', function() {
			// There can only be one topic_success because the config sets the unique_key
			const payload= {topic, json: unique_json};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(function(result){
				throw Error("DUPLICATE JOB CREATED!!! " + topic);}).catch(function(e){
				console.log(e);
				return e.name.should.equal(runqueue_service.ERR_DUPLICATE_JOB);
			});
		});

		it('Add jobs to exceed the group_ref limit', function() {
			const payload1= {topic, json: unique_json, unique_key: 'topic_success_1'};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload1)).then(function(result){
				const payload2= {topic, json: unique_json, unique_key: 'topic_success_2'};
				return runqueue_service.AddJob(ctx, payload2);
			});
		});

		it('_Poll the jobs', function() {
			const job= _.merge(base_job_result[ topic], {topic, run_at});
			const job1 = _.merge({}, job, {unique_key: 'topic_success_1'});
			const job2 = _.merge({}, job, {unique_key: 'topic_success_2'});
			return Promise.delay(1000) // Wait a second, because the poller won't pick up until run_at of 0,secs is in the past
			.then(() => runqueue_service._Poll()).then(function(result){
				const job_active= _.merge((_.clone(job)), {in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()});
				const job1_active= _.merge((_.clone(job1)), {in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()});
				clean_poll_result(result, true);

				result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt: base_group_cnt },
					{ next_jobs: [ job, job1, job2 ] },

					// Each job executed creates this triplet
					// Job 0
					{ MarkJobPending_result: [ job_active ] },
					{ topic_method_result: {success: true} },
					{ process_result: {affectedRows: 1} }, // Removed result

					// Job 1
					{ MarkJobPending_result: [ job1_active ] },
					{ topic_method_result: {success: true} },
					{ process_result: {affectedRows: 1} } // Removed result
		
				]);
				jobs_to_expect_at_the_end.push(_.merge((_.clone(job_active)), {di: 1}));
				return jobs_to_expect_at_the_end.push(_.merge((_.clone(job1_active)), {di: 1}));}).catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});

		it('_Poll for the job throttled by group_ref', function() {
			const job= _.merge(base_job_result[ topic], {topic, run_at});
			const job2 = _.merge({}, job, {unique_key: 'topic_success_2'});
			return Promise.delay( 1000) // Wait a second, because the poller won't pick up until run_at of 0,secs is in the past
			.then(() => runqueue_service._Poll()).then(function(result){
				const job2_active= _.merge((_.clone(job2)), {in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()});
				clean_poll_result(result, true);
				result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt: base_group_cnt },
					{ next_jobs: [ job2 ] },

					// Job 2
					{ MarkJobPending_result: [ job2_active ] },
					{ topic_method_result: {success: true} },
					{ process_result: {affectedRows: 1} } // Removed result
				]);
				return jobs_to_expect_at_the_end.push(_.merge((_.clone(job2_active)), {di: 1}));}).catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});

		it('_Poll the job quickly after polling it once. (Job should be processed and gone)', function() {
			const post_group_cnt= _.clone(base_group_cnt);
			//post_group_cnt[ group_ref]--
			return Promise.resolve()
			.then(() => runqueue_service._Poll()).then(function(result){
				clean_poll_result(result);
				return result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt },
					{ next_jobs:[ ] }
				]);})

			.catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});

		return it('_Poll the job after success/remove (should be no jobs in the queue)', function() {
			const post_group_cnt= _.clone(base_group_cnt);
			// SHOULD BE GONE, YES? post_group_cnt[ group_ref]--
			return Promise.delay( 1000) // Give little time for the response from the job-function writes to the DB
			.then(() => runqueue_service._Poll()).then(function(result){
				clean_poll_result(result);
				return result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt },
					{ next_jobs:[ ] }
				]);})

			.catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});
	});

	describe('AddJob my_test_topic HAPPY path: ', function() {
		const topic= 'my_test_topic';
		const group_ref= 'SampleTest';
		let run_at= false;

		it('Topic, json, and run_at', function() {
			const payload= {topic, json: unique_json, run_at: [1,'s']};
			return Promise.resolve()
			.then(() => runqueue_service.AddJob(ctx, payload)).then(function(result){
				run_at= moment().add(1,'s').format();
				const job= _.merge(base_job_result[ topic], payload, {run_at, group_ref});
				clean_db_jobs(result);
				return result.should.deep.equal([job]);});
	});

		it('_Poll the job before it is ready to run (no jobs)', function() {
			const job= _.merge(base_job_result[ topic], {topic, run_at});
			return Promise.delay( 250) // Wait less than a second
			.then(() => runqueue_service._Poll()).then(function(result){
				clean_poll_result(result);
				return result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt: base_group_cnt },
					{ next_jobs: [ ] }
				]);})

			.catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});

		it('_Poll the job when it is ready', function() {
			const f= 'Poll the job when it is ready>>>>';
			const job= _.merge(base_job_result[ topic], {topic, run_at});
			const post_group_cnt= _.clone(base_group_cnt);
			// NOT YET, JOB IS NOT RUNNING; post_group_cnt[ group_ref]--
			return Promise.delay( 2000) // Wait a bit, because the poller won't pick up until run_at of 0,secs is in the past
			.then(() => runqueue_service._Poll()).then(function(result){
				_log(f, result);
				const job_active= _.merge((_.clone(job)), {in_process: 1, fail_at: moment().add( fail_default[ 0], fail_default[ 1]).format()});
				const replace= {run_at: [ 20, 's'], json: job.json};
				const job_replace= _.merge((_.clone(job)), {run_at: moment().add( 20, 's').format()});
				clean_poll_result(result);
				const expected_result= [
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt },
					{ next_jobs: [ job ] },
					{ MarkJobPending_result: [ job_active ] },
					{ topic_method_result: {success: true, replace} },
					{ process_result: [ job_replace ] } // Job put back onto queue
				];
				result.should.deep.equal(expected_result);
				return jobs_to_expect_at_the_end.push(_.merge((_.clone(job_replace)), {}));}) // Any changes?

			.catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});

		it('_Poll the job quickly after polling it once. (expect to see the rescheduled job, and group not active)', function() {
			const post_group_cnt= _.clone(base_group_cnt);
			// JOB IS NOT ACTIVE post_group_cnt[ group_ref]--
			return Promise.resolve()
			.then(() => runqueue_service._Poll()).then(function(result){
				clean_poll_result(result);
				return result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt },
					{ next_jobs:[ ] }
				]);})

			.catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});

		return it('_Poll the job after success/remove (should be no waiting jobs for 20 seconds)', function() {
			const post_group_cnt= _.clone(base_group_cnt);
			// NONE ACTIVE post_group_cnt[ group_ref]--
			return Promise.delay( 1000) // Give little time for the response from the job-function writes to the DB
			.then(() => runqueue_service._Poll()).then(function(result){
				clean_poll_result(result);
				return result.should.deep.equal([
					{ pre_group_cnt: base_group_cnt },
					{ post_group_cnt },
					{ next_jobs:[ ] }
				]);})

			.catch(function(result){
				_log(result);
				if (result.body) {
					result.body.should.deep.equal({});
				}
				throw result;
			});
		});
	});

	describe('test HealthCheck', function() {
		const topic = 'topic_success';
		const expected = {status: 'g', details: {}};

		it('Everything is OK', () => Promise.resolve()
        .then(() => runqueue_service.HealthCheck(ctx)).then(result => result.should.deep.equal(expected)));

		it('Topic is delayed', () => Promise.resolve()
        .then(function() {
            const payload = _.merge({}, {topic , run_at: [-4, 'm'], json: health_check_json, unique_key: 'HealthCheck_delayed'});
            return runqueue_service.AddJob(ctx, payload);}).then(() => runqueue_service.HealthCheck(ctx)).then(function(result){
            //Hack to deal with timing issues
            const {
                delay
            } = result.details.delays[0];
            delay.should.be.above(239);
            expected.status = 'y';
            expected.details.delays = [{topic, delay}];
            return result.should.deep.equal(expected);
        }));

		it('Topic has retries', function() {
			const expected_retries = 4;

			return Promise.resolve()
			.then(function() {
				const payload = _.merge({}, {topic , run_at: [0, 's'], json: health_check_json, unique_key: 'HealthCheck_retried'});
				return runqueue_service.AddJob(ctx, payload);}).then(function(job) {
				const values = {last_reason: 'forced fail', run_at: moment().format()};
				const fail_promises = (__range__(1, expected_retries, true).map((i) => runqueue_service.sdb.runqueue.Fail(ctx, job[0].id, values)));

				return Promise.all(fail_promises);}).then(function() {
				//Update the expected with the new error
				expected.details.retries = [{topic, max_retries: expected_retries}];
				return runqueue_service.HealthCheck(ctx);}).then(result => result.details.retries.should.deep.equal(expected.details.retries));
		});

		return it('Topic has failures (timeout)', () => Promise.resolve()
        .delay(1000)
        .then(function() {
            const payload = _.merge({}, {topic , run_at: [0, 's'], json: health_check_json, unique_key: 'HealthCheck_failure'});
            return runqueue_service.AddJob(ctx, payload);}).then(function(job) {
            const fail_at = moment().add(0, 's').format();
            return runqueue_service.sdb.runqueue.MarkJobPending(ctx, job[0].id, {fail_at});})
        .then(function() {
            //Update the expected with the new error
            expected.status = 'r';
            expected.details.failures = [{topic, failures: 1}];
            return runqueue_service.HealthCheck(ctx);}).then(result => result.details.failures.should.deep.equal(expected.details.failures)));
	});

	return describe('Finalize, query for expected jobs in DB: ', function() {
		const topic= 'my_test_topic';
		const group_ref= 'SampleTest';
		const run_at= false;

		return it('Only the jobs we expect', () => Promise.resolve()
        .then(() => mydb.runqueue.find({ json: { $nin: [health_check_json] } })
        .toArray(function(err, result){
            if (err(() => { throw err; })()) {
            return result.should.deep.equal(jobs_to_expect_at_the_end);
    }})));
	});
});

function __guard__(value, transform) {
  return (typeof value !== 'undefined' && value !== null) ? transform(value) : undefined;
}
function __range__(left, right, inclusive) {
  let range = [];
  let ascending = left < right;
  let end = !inclusive ? right : ascending ? right + 1 : right - 1;
  for (let i = left; ascending ? i < end : i > end; ascending ? i++ : i--) {
    range.push(i);
  }
  return range;
}