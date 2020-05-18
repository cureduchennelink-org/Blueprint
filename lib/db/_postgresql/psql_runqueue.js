// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	RunQueue Database Functions
//
//	A RunQueue is a DB backed 'run exactly once' persitent store, indexed to optimize for 'what runs next' polling
//	Is a standalone table (no joins) but other tables may hold 'id's
//
const Promise= require('bluebird');
const _= require('lodash');
const it_is= require('is_js');

class PSqlRunQueue {
	constructor(core, kit){
		this.log= kit.services.logger.log;
		this.E= kit.services.error;
		this.db= core;
		this.table= 'runqueue';
		this.schema= {
			AddJob: {
				allowed: [
					'topic', 'group_ref',
					'priority', 'run_at',
					'json',
					],
				defaults: {
					in_process: 0, retries: 0, fail_at: null, last_reason: null
				}
			},
			ReplaceJob: {
				allowed: [ // Cannot change the 'topic' eh? but 'json' is ok I guess.
					'priority', 'run_at',
					'json',
					],
				defaults: {
					in_process: 0, retries: 0, fail_at: null, last_reason: null,
					json: null
				}
			},
			Fail: {
				required: [
					'last_reason', 'run_at',
					],
				defaults: {
					in_process: 0, fail_at: null
				}
			} // These need to be reset (Need to bump retries also)
		};

		this.db.method_factory(this, 'PSqlRunQueue'); // TODO NEEDED?
	}

	async GetPendingCnts(ctx){
		const f= "PSqlRunQueue:GetPendingCnts:";
		ctx.silent = true

		// TODO CONSIDER HOW TO HANDLE FAIL_AT - WHO WILL SEE THESE AND RESTART THEM? WHILE IN_PROCESS=1 
		// *AND* FAIL_AT IN PAST, DO WE STILL COUNT HERE?
		const sql= `
			SELECT COUNT(*) active_cnt, group_ref
			FROM ${this.table}
			WHERE in_process= 1 AND di= 0
			GROUP BY group_ref
		`;

		return await this.db.sqlQuery(ctx, sql)
	}

	GetNextJobs(ctx, max_rows, max_retries){
		if (max_retries == null) { max_retries = 8; }
		const f= "PSqlRunQueue:GetNextJobs:";

		// TODO CHECK ORDER BY RUN_AT (OLDER DATE FIRST) AND PRIORITY (1 before 8)
		// TODO COULD LEAVE DI CHECK OUT IF CALLER WILL REMOVE THOSE LATER? ELSE A JOB REMOVES THEM EVENTUALLY
		const sql= `\
SELECT *
FROM ${this.table}
WHERE in_process= 0 AND run_at< NOW() AND retries< ? AND di= 0
ORDER BY priority, run_at
LIMIT ?\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, [ max_retries, max_rows]);});
	}

	MarkJobPending(ctx, id, other_values, reread){ // Fails if other_values has nothing
		if (reread == null) { reread = false; }
		const f= "PSqlRunQueue:MarkJobPending:";

		const sets= [ 'in_process= ?'];
		const args= [ 1];
		for (let nm in other_values) {
			const val = other_values[nm];
			sets.push(`${nm}= ?`);
			args.push(val);
		}
		args.push(id);
		// When in_process isnt 0, another server got here first, so caller checks 'affectedRows is 1' (means the 'win')
		const sql= `\
UPDATE ${this.table}
SET ${sets.join(',')}
WHERE id= ? AND in_process= 0\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, args);}).then(function(db_result){
			if (reread !== true) { return db_result; } // Caller will check for success
			if (db_result.affectedRows !== 1) { return []; }

			return this.db.sqlQuery(ctx, `SELECT * FROM ${this.table} WHERE ID= ?`, [id]);});
	}

	RemoveByIds(ctx, ids){
		const f= "PSqlRunQueue:RemoveByIds:";
		if (!it_is.array(ids)) { ids= [ ids]; }

		const sql= `\
UPDATE ${this.table}
SET di= 1
WHERE id IN (?)\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, [ids]);});
	}

	RemoveByUniqueIds(ctx, uniqueIds){
		const f= "PSqlRunQueue:RemoveByUniqueIds:";

		if (!it_is.array(uniqueIds)) { uniqueIds= [ ids]; }

		const sql= `\
UPDATE ${this.table}
SET di= 1
WHERE unique_id IN (?)\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, uniqueIds);
		});
	}

	AddJob(ctx, new_values, reread){
		let nm, val;
		if (reread == null) { reread = false; }
		const f= "PSqlRunQueue:AddJob:";
		const e= f;

		const allowed_values= {};
		for (nm in new_values) {
			val = new_values[nm];
			if (!Array.from(this.schema.AddJob.allowed).includes(nm)) { throw new this.E.DbError(e+`UNKNOWN_COL:${nm}`); }
			allowed_values[ nm]= val;
		}

		const values= _.merge({}, this.schema.AddJob.defaults, allowed_values);
		const cols= ['cr'];
		const vals= ['?'];
		const args= [null];
		for (nm in values) {
			val = values[nm];
			cols.push(nm);
			vals.push('?');
			args.push(val);
		}
		const sql= `\
INSERT INTO ${this.table} ( ${cols} ) VALUES ( ${vals} )\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, args);}).then(function(db_result){
			if (reread !== true) { return db_result; } // Caller will check for sucess
			if (db_result.affectedRows !== 1) { return []; }
			const id= db_result.insertId;

			return this.db.sqlQuery(ctx, `SELECT * FROM ${this.table} WHERE ID= ?`, [id]);});
	}

	ReplaceJob(ctx, id, new_values, reread){
		let nm, val;
		if (reread == null) { reread = false; }
		const f= "PSqlRunQueue:AddJob:";
		const e= f;

		const allowed_values= {};
		for (nm in new_values) {
			val = new_values[nm];
			if (!Array.from(this.schema.ReplaceJob.allowed).includes(nm)) { throw new this.E.DbError(e+`UNKNOWN_COL:${nm}`); }
			allowed_values[ nm]= val;
		}

		const values= _.merge({}, this.schema.ReplaceJob.defaults, allowed_values);
		const sets= [];
		const args= [];
		for (nm in values) {
			val = values[nm];
			sets.push(`${nm}=?`);
			args.push(val);
		}
		args.push(id);
		const sql= `\
UPDATE ${this.table}
SET ${sets}
WHERE ID= ?\
`;
		return Promise.resolve().bind(this)
		.then(function() {

			return this.db.sqlQuery(ctx, sql, args);}).then(function(db_result){
			if (reread !== true) { return db_result; } // Caller will check for sucess
			if (db_result.affectedRows !== 1) { return []; }

			return this.db.sqlQuery(ctx, `SELECT * FROM ${this.table} WHERE ID= ?`, [id]);});
	}

	Fail(ctx, id, new_values, reread){
		let nm, val;
		if (reread == null) { reread = false; }
		const f= "PSqlRunQueue:Fail:";
		const e= f;

		const allowed_values= {};
		for (nm in new_values) {
			val = new_values[nm];
			if (!Array.from(this.schema.Fail.required).includes(nm)) { throw new this.E.DbError(e+`UNKNOWN_COL:${nm}`); }
		}
		for (nm of Array.from(this.schema.Fail.required)) {
			if (!(nm in new_values)) { throw new this.E.DbError(e+`MISSING_COL:${nm}`); }
			allowed_values[ nm]= new_values[ nm];
		}

		const values= _.merge({}, this.schema.Fail.defaults, allowed_values);
		const sets= ['retries= retries+ 1'];
		const args= [];
		for (nm in values) {
			val = values[nm];
			sets.push(`${nm}=?`);
			args.push(val);
		}
		args.push(id);
		const sql= `\
UPDATE ${this.table}
SET ${sets}
WHERE ID= ?\
`;
		return Promise.resolve().bind(this)
		.then(function() {

			return this.db.sqlQuery(ctx, sql, args);}).then(function(db_result){

			if (reread !== true) { return db_result; } // Caller will check for sucess
			if (db_result.affectedRows !== 1) { return []; }

			return this.db.sqlQuery(ctx, `SELECT * FROM ${this.table} WHERE ID= ?`, [id]);});
	}

	GetDelayedByTopic(ctx) {
		const f= "PSqlRunQueue:GetDelayedByTopic:";

		const sql= `\
SELECT topic, TIMESTAMPDIFF(SECOND,MIN(run_at), NOW()) AS 'delay'
FROM ${this.table}
WHERE run_at < NOW() and di = 0 and in_process = 0
GROUP BY topic\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, []);});
	}

	GetRetriesByTopic(ctx) {
		const f= "PSqlRunQueue:GetRetriesByTopic:";

		const sql= `\
SELECT topic, MAX(retries) AS 'max_retries'
FROM ${this.table}
WHERE di = 0 and retries > 0
GROUP BY topic\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, []);});
	}

	GetFailuresByTopic(ctx) {
		const f= "PSqlRunQueue:GetFailuresByTopic:";

		const sql= `\
SELECT topic, COUNT(*) AS 'failures'
FROM ${this.table}
WHERE di = 0 and in_process = 1 and fail_at < NOW()
GROUP BY topic\
`;
		return Promise.resolve().bind(this)
		.then(function() {
			return this.db.sqlQuery(ctx, sql, []);});
	}
}

exports.PSqlRunQueue= PSqlRunQueue;
