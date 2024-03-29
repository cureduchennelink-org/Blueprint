// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS201: Simplify complex destructure assignments
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Service: RunQueue (DB backed, Monolith, Exactly-once, Exponential back off, Re-occurring semantics, crash recovery)
//	JCS: Updated to use port to MongoDB
//
const Promise = require('bluebird');
const _ = require('lodash');
const it_is = require('is_js');
const moment = require('moment');
const VALID_UNITS = ['months', 'M', 'weeks', 'w', 'days', 'd', 'hours', 'h', 'minutes', 'm', 'seconds', 's',];

class RunQueue {
	static deps() {
		return {
			services: ['config', 'error', 'slack'], // Also, FYI, there are dynamic references to services per config.topics
			mysql: ['runqueue'],
			config: [
				'runqueue.topic_defaults{back_off,last_fail,priority,external_group,limit,alarm_cnt,warn_cnt,warn_delay,alarm_delay}',
				'runqueue.external_groups[default/ANY{connections,requests}]',
				'runqueue.topics.ANY{call,type,priority,run_at,external_group}',
				'runqueue.settings[poll_interval_ms,jobs,read_depth, pollLogDelay]',
				'runqueue[mongodb_uri,mongodb_name]'
			]
		};

	}

	constructor(kit) {
		let nm, rec;
		this.server_start = this.server_start.bind(this);
		this._Poll = this._Poll.bind(this);
		this.resource = `RunQueue`
		this.f = `${this.resource}::constructor`
		this.log = kit.services.logger.log;
		this.log2 = { debug() { } }; // DEBUG this.log;
		this.E = kit.services.error;
		// TODO: Let's make this a conditional based on what we need. Mongo / MySQL
		// TODO: SDB IS DEPRECATED, USE THIS.DB
		this.sdb = kit.services.db.psql;
		this.db = kit.services.db.psql;
		this.slack = { send: message => this.log.debug('RunQueue:slack.send', { message }) } // TODO kit.services.slack;

		this.config = kit.services.config.runqueue;
		this.log2.debug('RUNQUEUE', this.config); // XXX
		this.allConfig = kit.services.config

		this.defaults = {
			interval: 5000
		}

		this.machine = this.allConfig.api.machine

		this.isDraining = false;
		this.pollProcessing = false; // To keep from poller running on top of us
		this.pollLogDelay = false;
		this.job_cnt = 0; // Active jobs running on this server; Should not exceed @config.settings.jobs

		this.finish_promise = Promise.resolve().bind(this); // Used to serialize all writes back to the job queue
		this.topics = {};
		for (nm in this.config.topics) {
			rec = this.config.topics[nm];
			this.topics[nm] = _.merge({ nm }, this.config.topic_defaults, rec);
		}

		this.groups = {};
		const group_defaults = this.config.external_groups['default']; // Quotes for you, John.
		for (nm in this.config.external_groups) {
			rec = this.config.external_groups[nm];
			if (nm !== 'default') {
				this.groups[nm] = _.merge({}, group_defaults, rec);
			}
		}

		this.log.debug(`${this.f}::`, { topics: this.topics, groups: this.groups });

		this.ERR_DUPLICATE_JOB = "DuplicateJobError";

		this.hungPollerBackoff = [
			["5", "m"],
			["30", "m"],
			["2", "h"],
			["5", "h"],
			["12", "h"],
			["1", "d"],
		]

		this._ResetPollerMeta()

		// These methods return a number of seconds to add to the job time
		this._back_off_strategies = {
			// The standard back off strategy
			standard: (retries) => { if (retries === 0) { return 0; } else { return retries ^ (4 + 5 + this._back_off_strategies.standard(retries - 1)); } },

			//Test Strategies
			// One year.  Used to prevent test jobs from re-running
			year: (retries) => { if (retries === 0) { return 0; } else { return 365 * 24 * 60 * 60; } },
			// Immediately retry.
			immediate: (retries) => { return 0; }
		};
	}

	server_start(kit) { // After the services are all created, we need to validate/load our dynamic references per topic
		const f = 'RunQueue::server_start:';
		for (let nm in this.topics) {
			const topic = this.topics[nm];
			topic.nm = nm;
			this.log.debug(f, { topic });
			const [service, method] = Array.from(topic.service.split('.'));
			if (!(service in kit.services)) { throw new Error(`KIT DOES NOT HAVE SERVICE (${service}) MENTIONED IN TOPIC (${nm}) AS [${topic.service}]`); }
			if (!it_is.string(topic.back_off)) { throw new Error(`KIT DOES NOT HAVE BACK OFF STRATEGY IN TOPIC (${nm})`); }
			if (!it_is.function(this._back_off_strategies[topic.back_off])) { throw new Error(`UNKNOWN BACK OFF STRATEGY ${topic.back_off} IN TOPIC ${nm} should be one of [${Object.keys(this._back_off_strategies)}]`); }
			if (!(method in kit.services[service])) { throw new Error(`METHOD (${method}) NOT FOUND IN SERVICE (${service}) MENTIONED IN TOPIC (${nm}) AS [${topic.service}]`); }
			topic._method = kit.services[service][method];
			if (!it_is.function(topic._method)) { throw new Error(`NOT A FUNCTION: (${topic.service}) MENTIONED IN TOPIC (${nm})`); }
			topic._method = kit.services[service][method].bind(kit.services[service]); // JCS: Try to be a nice neighbor
			topic.alarm_delay_sec = this._calc_secs(topic.alarm_delay, `${nm}.alarm_delay`);
			topic.warn_delay_sec = this._calc_secs(topic.warn_delay, `${nm}.warn_delay`);
		}

		// Don't return the promise; should not complete ever
		this._PollWrapper__promise = this._PollWrapper() // XXX NOW ASYNC, BUT DON"T WAIT ON IT HERE.
			.then((result) => this.log.debug(f + 'poll-then', result))
			.catch((e) => this.log.debug(f + 'poll-catch', e))

		return null; // to avoid warning, http://goo.gl/rRqMUw
	}

	// Stop taking in new job requests, the server is coming down
	Drain() {
		const f = `${this.resource}::Drain`;
		const needToDrain = this.isDraining === false
		this.log.info(`${f}::ARE WE GOING TO DRAIN?`, { needToDrain });
		if (needToDrain) {
			return this.isDraining = true; // Takes affect after interval in while (!this.isDraining)
		}
	}

	_pick_at(retries, which, topic, other_object) { // E.g. 0, 'run_at', topic_as_str_or_@topics[nm], users_object_with_optional_override
		let at;
		const f = 'RunQueue::_pick_at:';
		//@log.debug f, {retries,which,topic,other_object}
		const resolved_topic = it_is.string(topic) ? this.topics[topic] : topic;
		if (it_is.object(other_object) && other_object[which]) {
			// Overridden by either array as [N,S] or expect a date
			at = other_object[which];
		} else {
			at = resolved_topic[which];
		}

		const back_off_strategy = resolved_topic['back_off'];

		if (it_is.array(at)) {
			return this._calc_at((this._back_off_strategies[back_off_strategy](retries)), at, `${resolved_topic.nm}:${which}`);
		} else {
			return moment(at).format();
		}
	}

	_validate_format(spec, name) {
		if ((it_is.array(spec)) && (it_is.number(spec[0])) && (it_is.string(spec[1])) && Array.from(VALID_UNITS).includes(spec[1])) {
			return true;
		} else { throw new Error(`SPEC (${name}) WAS NOT AN ARRAY OF NUMBER AND STRING-UNIT (${spec})`); }
	}

	_calc_secs(spec, name) {
		this._validate_format(spec, name);
		return moment(0).add(spec[0], spec[1]).unix();
	}

	_calc_at(base, spec, name) {
		this._validate_format(spec, name);
		return moment().add(base, 's').add(spec[0], spec[1]).format();
	}

	// Details: req'd: {topic:K,json:S} overrides: {priority:I,run_at:[I,S]}
	AddJob(ctx, details, job_id) { // Caller provides promise wrapper (internal, job_id set if 'replace'
		if (job_id == null) { job_id = false; }
		const f = 'RunQueue::AddJob:';
		if (job_id === false) {
			for (let nm of ['topic', 'json',]) {
				if (!(nm in details)) { this.log.debug(f, this.E.MissingArg(nm)); }
				if (!(nm in details)) { throw this.E.MissingArg(nm); }
			}
			if (!(details.topic in this.topics)) { throw new this.E.InvalidArg(`topic (${details.topic})`); }
		}
		const topic = this.topics[details.topic];

		// Pull values that will become DB column names
		const defaults = _.pick(topic, ['priority', 'unique_key']); // User can supply/override these (merged in first)
		const only_topics = _.pick(topic, ['group_ref',]); // Caller cannot override these (merged in last)
		const allowed_details = _.pick(details, ['topic', 'priority', 'unique_key', 'json',]);
		allowed_details.run_at = this._pick_at(0, 'run_at', topic, details);

		const new_values = _.merge({}, defaults, allowed_details, only_topics);

		return Promise.resolve().bind(this)
			.then(function () {
				let reread;
				if (job_id === false) {
					return this.sdb.runqueue.AddJob(ctx, new_values, (reread = true));
				} else {
					const replace_values = _.pick(new_values, [ // List from sql layer for ReplaceJob
						'unique_key',
						'priority', 'run_at',
						'json',
					]);
					return this.sdb.runqueue.ReplaceJob(ctx, job_id, replace_values, (reread = true));
				}
			}).catch(function (e) {
				if ((
					(e.errno === 1062) && e.sqlMessage.includes("ix_runqueue__unique_key")
				) || (
						(e.code === 11000) && e.errmsg.includes('duplicate key error collection')
					)) {
					e.name = this.ERR_DUPLICATE_JOB;
				}
				throw e;
			});
	}

	// TODO: IDENTIFY IF WE ARE USING???
	RemoveJobsByIds(ids) {
		const f = 'RunQueue::RemoveJobsByIds:';
		this.finish_promise = this.finish_promise.then(function () {
			return Promise.resolve().bind(this)
				.then(function () {
					return this.sdb.runqueue.RemoveByIds(this.ctx_finish, ids);
				}).catch(function (e) {
					return this.log.error(f, e);
				});
		});
	}

	// TODO: IDENTIFY IF WE ARE USING???
	RemoveJobsByUniqueIds(uniqueIds) {
		const f = 'RunQueue::RemoveJobsByUniqueIds:';
		this.finish_promise = this.finish_promise.then(function () {
			return Promise.resolve().bind(this)
				.then(function () {
					return this.sdb.runqueue.RemoveByExtern(this.ctx_finish, uniqueIds);
				}).catch(function (e) {
					return this.log.error(f, e);
				});
		});
	}

	_set_status(status_obj, status, detail_name, row) {
		//Red is max, always set it
		//Only set yellow if we are green
		if ((status === 'r') || (status_obj.status === 'g')) {
			status_obj.status = status;
		}

		if (status_obj.details[detail_name] === undefined) {
			status_obj.details[detail_name] = [];
		}
		return status_obj.details[detail_name].push(row);
	}

	// Returns a status structure
	// {status: [r|y|g], details: {[delays|retries|failures] : [{topic, <detail>}, ...]}
	HealthCheck(ctx) {
		const f = 'RunQueue::HealthCheck:';
		const status = { status: 'g', details: {} };
		return Promise.resolve().bind(this)
			.then(function () {
				return this.sdb.runqueue.GetDelayedByTopic(ctx);
			}).then(function (result) {
				for (let row of Array.from(result)) {
					const topic = this.topics[row.topic];
					if (row.delay >= topic.alarm_delay_sec) {
						this._set_status(status, 'r', 'delays', row);
					} else if (row.delay >= topic.warn_delay_sec) {
						this._set_status(status, 'y', 'delays', row);
					}
				}

				return this.sdb.runqueue.GetRetriesByTopic(ctx);
			}).then(function (result) {
				for (let row of Array.from(result)) {
					const topic = this.topics[row.topic];
					if (row.max_retries >= topic.alarm_cnt) {
						this._set_status(status, 'r', 'retries', row);
					} else if (row.max_retries >= topic.warn_cnt) {
						this._set_status(status, 'y', 'retries', row);
					}
				}

				return this.sdb.runqueue.GetFailuresByTopic(ctx);
			}).then(function (result) {
				if (!it_is.empty(result)) {
					// Go right to code red
					status.status = 'r';
					status.details.failures = result;
				}

				return status;
			});
	}

	_UpdatePollDelay() {
		if (this.pollLogDelay !== false && !moment().isAfter(this.pollLogDelay)) return;
		const { quantity, measurement } = this.config.settings.pollLogDelay
		this.pollLogDelay = moment().add(quantity, measurement)
	}

	async _HandleHungPoller() {
		if (this.pollProcessing === false) return false

		const addToAttempts = this.pollerProcessingAttempts.length < 10

		const hasEnoughTimePassed = () => {
			const timeValues = this.hungPollerBackoff[this.hungPollerPointer]
			const nextTimeToSend = moment().subtract(timeValues[0], timeValues[1])
			return this.lastPollerNotification.isBefore(nextTimeToSend)
		}

		if (addToAttempts) {
			this.pollerProcessingAttempts.push(true);
			this.lastPollerNotification = moment()
		}

		if (!addToAttempts && hasEnoughTimePassed()) {
			this.lastPollerNotification = moment()

			if (this.hungPollerPointer + 1 < this.hungPollerBackoff.length) {
				this.hungPollerPointer++;
			}

			await this.slack.send(`POLLER IS STUCK ON ${this.machine}`)
		}

		return true
	}

	_ResetPollerMeta() {
		this.pollerProcessingAttempts = []
		this.hungPollerPointer = 0
	}

	async _PollWrapper() {
		const f = `${this.resource}::_PollWrapper`
		let interval = this.config.settings.poll_interval_ms;
		if (!interval) {
			this.log.debug(`${f}::USING DEFAULT INTERVAL :>>`, this.defaults.interval)
			interval = this.defaults.interval;
		}
		this.log2.debug('RUNQUEUE', { interval }); // XXX

		// XXX this.pollerInterval = setInterval(async () => {
		while (this.isDraining === false) {

			this.log2.debug('RUNQUEUE:BEFORE', { interval }); // XXX
			await Promise.delay(interval);
			this.log2.debug('RUNQUEUE:AFTER:DELAY', { interval, isDraining: this.isDraining }); // XXX
			if (this.isDraining !== false) continue;
			const pollerIsHung = await this._HandleHungPoller()
			this.log2.debug('RUNQUEUE:AFTER:HUNG', { pollerIsHung }); // XXX
			if (pollerIsHung === true) continue; // XXX WAS: return;

			this._ResetPollerMeta()
			const ctx = {
				log: this.log,
				conn: false,
				silent: true,
			}
			this.log2.debug('RUNQUEUE:BEFORE:ACQUIRE', { ctx }); // XXX
			const freshConnection = await this.db.core.Acquire()
			this.log2.debug('RUNQUEUE:AFTER:ACQUIRE', { interval }); // XXX
			ctx.conn = freshConnection

			try {
				this.pollProcessing = true;
				this.log2.debug('RUNQUEUE:BEFORE:POLL', { pollProcessing: this.pollProcessing }); // XXX
				const poll_result = await this._Poll(ctx)
				this.log2.debug('RUNQUEUE:DURING:POLL', { poll_result }); // XXX
				this._UpdatePollDelay()
				this.pollProcessing = false;
				this.log2.debug('RUNQUEUE:AFTER:POLL', { pollProcessing: this.pollProcessing }); // XXX
			} catch (e) {
				this.log2.debug('RUNQUEUE:POLL:ERROR', e); // XXX
				await this.slack.send(e)
			} finally {
				this.log2.debug('RUNQUEUE:FINALLY', { interval }); // XXX
				this.db.core.release(ctx.conn);
				ctx.conn = false;
			}
			this.log2.debug('RUNQUEUE:BOTTOM', { interval }); // XXX
		}
		// XXX }, interval)
	}

	// Get at most settings.read_depth jobs,
	//   and spawn them up to the connection limit on the group, not to exceed our own settings.jobs
	async _Poll(ctx) {
		let rec;
		const f = `${this.resource}::_Poll`;
		const rVal = []; // Returned to caller for testing (when unit tests call us directly)

		const logPolling = this.pollLogDelay === false || moment().isAfter(this.pollLogDelay)
		if (logPolling) {
			this.log.debug(`${f} :>> POLLER HEARTBEAT.`)
		}
		this.log2.debug(`${f} :>> POLLER HEARTBEAT.`) // XXX

		// Note: Assumes catastrophic errors only when server crashes
		if (this.job_cnt > this.config.settings.jobs) return { stop: 'job_cnt' }  // We are still over our local max outstanding jobs

		const group_cnt = {}; // Don't exceed these counts
		for (let nm in this.groups) { rec = this.groups[nm]; group_cnt[nm] = rec.connections; }
		rVal.push({ pre_group_cnt: _.clone(group_cnt) });

		const pendingCounts = await this.sdb.runqueue.GetPendingCnts(ctx)
		for (rec of Array.from(pendingCounts)) { group_cnt[rec.group_ref] -= rec.active_cnt; }
		rVal.push({ post_group_cnt: _.clone(group_cnt) });

		const nextJobs = await this.sdb.runqueue.GetNextJobs(ctx, this.config.settings.read_depth)

		rVal.push({ next_jobs: nextJobs });

		if (nextJobs.length === 0) {
			return;
		}
		this.log2.debug(`${f} :>> ${nextJobs.length} JOB${nextJobs.length > 1 ? 'S' : ''} FOUND.`)

		await Promise.map(nextJobs, async (job) => {
			if (group_cnt[job.group_ref] < 1) return;
			const fail_at = this._calc_at(0, this.topics[job.topic].fail_at, job.topic + '.fail_at'); // COULD THROW ERROR AND NOT PROCESS REST OF JOBS!
			const jobsPending = await this.sdb.runqueue.MarkJobPending(ctx, job.id, { fail_at }, true)
			rVal.push({ MarkJobPending_result: jobsPending });
			if (jobsPending.length !== 1) return [false]

			let topicResult;

			try {
				topicResult = await this.topics[job.topic]._method(job);
				rVal.push({ topic_method_result: topicResult });
			} catch (e) {
				rVal.push({ topic_method_error: e });
				topicResult = { error: e }
			}

			const processedResult = await this._ProcessTopicResult(ctx, job, topicResult);
			rVal.push({ process_result: processedResult });
		}, { concurrency: 1 })

		return rVal;
	}

	// Topic-result can be 3 possible things
	// (a) Remove the job when done
	// (b) Re-schedule job fresh (as retries=0)
	// (c) Failure, so mark as such to try again later
	async _ProcessTopicResult(ctx, job, topic_result) {
		const f = `${this.resource}::_ProcessTopicResult:`;

		if ('error' in topic_result) { // Caught error from running their logic
			topic_result = { success: false, reason: (topic_result.error != null ? topic_result.error.stack : undefined) != null ? (topic_result.error != null ? topic_result.error.stack : undefined) : topic_result.error.toString() };
		} else if (!('success' in topic_result)) {
			topic_result = { success: false, reason: "Bad Response: " + JSON.stringify(topic_result) };
		}

		this.log2.debug(`${f}:TOPIC RESULT FOR ${job.topic} :>>`, { topic_result });

		try {

			if (topic_result.success === true) {

				if (topic_result.replace) {
					// Json can change or not, but topic currently won't be replaced by the sql layer, but AddJob wants it
					//new_values= _.merge { json: job.json, }, topic_result.replace,{ topic: job.topic, }
					const new_values = _.merge({ topic: job.topic, }, topic_result.replace); // Allow topic override, but know sql won't change it
					// TODO new_values= topic_result.replace
					return this.AddJob(ctx, new_values, job.id); // Job.id on end does a replace
				}

				return this.sdb.runqueue.RemoveByIds(ctx, job.id);
			}

			if (job.retries === 3) {
				const topicDetails = this.config.topics[job.topic]
				if (topicDetails) {
					if (topicDetails.slackAlerts !== true) return false
					await this.slack.send(`${job.topic} IS FAILING. \n\n HERE'S WHY: ${topic_result.reason}`)
				}
			}

			const run_at = this._pick_at(job.retries + 1, 'run_at', job.topic, topic_result);
			return this.sdb.runqueue.Fail(ctx, job.id, { run_at, last_reason: topic_result.reason }, true);

		} catch (err) {
			this.log.error(f, { job, topic_result, err });
			return err;
		}
	}
}

exports.RunQueue = RunQueue;
