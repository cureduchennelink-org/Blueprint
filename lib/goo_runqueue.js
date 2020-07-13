// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const _ = require('lodash');

const Promise= require('bluebird');
const mongoose= require('mongoose');
mongoose.Promise= Promise;

const RunQueueMongoDbSchema= require('./goo_schema_runqueue');

// These are flags for turning our log functions on and off as we need them.
// If we want our log functions on, change testing to true.
const testing= process.env.DB_DEBUG_LEVEL2 === 'true';
let logRequest= function(){};
let logResponse= function(){};

if (testing) {
	logRequest= (f, obj) => // The Query that is going to turn into a Mongoose Model
    console.log("##### QUERY >>>" + f, obj);

	logResponse= function(f, objs){
		if (!Array.isArray(objs)) { objs= [objs]; }
		console.log("##### RESP >>> " + f, {length: objs.length});
		return (() => {
			const result = [];
			for (let obj of Array.from(objs)) {
				if ((obj != null ? obj.toJSON : undefined) != null) {
					result.push(console.log(" -#- ", obj.toJSON()));
				} else {
					result.push(undefined);
				}
			}
			return result;
		})();
	};
}

class RunQueueMongoDbPersistence {
	static deps() {
		return {};
	}

	constructor() {
		this._schema= new RunQueueMongoDbSchema();
	}

	open(uri, db_name){
		return new Promise((resolve, reject)=> {
			return mongoose.connect(uri, err=> { // Consider using .then, if supported
				if (err) { reject(err); }
				this._connection= mongoose.connection;
				const mydb= mongoose.connection.useDb(db_name);
				this._model= mydb.model('RunQueue', this._schema);
				return resolve();
			});
		});
	}


	close(){
		return new Promise((resolve, reject)=> {
			// Check if already closed
			if (this._model=== null) {
				return resolve();
			}

			return mongoose.disconnect(err=> {
				this._model= null;
				if (err) { return reject(err); } else { return resolve(); }
			});
		});
	}

	GetJobById(ctx, id){ return this._model.findById(id); }

	GetPendingCnts(ctx){
		const f="RunQueueMongoDbPersistence::GetPendingCnts: ";
		const pipeline= [
			{ $match: {in_process: 1, di: 0} },
			{ $group: {_id: '$group_ref', count: {$sum: 1}} }
		];

		logRequest(f, {pipeline});
		return this._model.aggregate(pipeline)
		.then(function(results){
		  	logResponse(f, results);
		  	return Array.from(results).map((r) => ({group_ref: r._id, active_cnt: r.count}));
		});
	}

	GetNextJobs(ctx, maxRows, maxRetries){
		if (maxRetries == null) { maxRetries = 8; }
		const f="RunQueueMongoDbPersistence::GetNextJobs: ";
		const date= new Date();
		const oneSLess= new Date(date - 1000); // we need to get the date minus one second
		const conditions= {
			in_process: 0,
			run_at: { $lte: oneSLess
		},   
			retries: { $lte: maxRetries
		},
			di: 0
		};

		// Record the query that we're using
		logRequest(f, { conditions, maxRows });

		return this._model
		.find(conditions)
		.sort({priority: 1, run_at: 1})
		.limit(maxRows)
		.then(function(model_result){
			logResponse(f, model_result);
			return Array.from(model_result).map((model) => model.toJSON());
		});
	}

	AddJob(ctx, newValues, reread){
		if (reread == null) { reread = false; }
		const f= 'RunQueueMongoDbPersistence::AddJob:';
		newValues= _.pick(newValues, 'unique_key', 'topic', 'group_ref', 'priority', 'run_at', 'json');
		_.merge(newValues, {
			mo: new Date(),
			in_process: 0,
			retries: 0
		}
		);
		newValues.in_process= 0;
		const options= {};

		logRequest(f, { newValues, options } );
		return new this._model(newValues)
		.save((options))
		.then(function(model_result){ 
			logResponse(f, model_result); 
			if (reread) { return [model_result.toJSON()]; } else { return {affectedRows: 1, insertId: model_result.toJSON().id}; }
		});
	}

	ReplaceJob(ctx, id, newValues, reread){
		if (reread == null) { reread = false; }
		const f= 'RunQueueMongoDbPersistence::ReplaceJob:';
		newValues= _.pick(newValues, 'unique_key', 'priority', 'run_at', 'json');
		const defaults= {in_process: 0, retries: 0};
		newValues= _.merge({}, defaults, newValues);
		newValues.mo= new Date();

		const unset= {};
		for (let nm of ['fail_at', 'last_reason', 'unique_key', 'json']) { if (!(nm in newValues)) { unset[ nm]= ''; } }
		const doc= {$set: newValues, $unset: unset};
		const options= {new: true, rawResult: true};

		logRequest(f, { id, doc, options } );
		return this._model.findByIdAndUpdate(id, doc, options)
		.then(function(mongo_result){
			logResponse(f, mongo_result);
			if (mongo_result && ((mongo_result.lastErrorObject != null ? mongo_result.lastErrorObject.n : undefined) === 1)) { // We did update the record
				if (reread) { return [mongo_result.value.toJSON()]; } else { return {affectedRows: 1}; }
			} else {
				if (reread) { return []; } else { return {affectedRows: 0}; }
			}
		});
	}

	MarkJobPending(ctx, id, otherValues, reread){
		if (reread == null) { reread = false; }
		const f= 'RunQueueMongoDbPersistence::MarkJobPending:';
		let newValues= otherValues != null ? otherValues : {};
		newValues= _.pick(newValues, 'unique_key', 'priority', 'run_at', 'json', 'fail_at');
		newValues.mo= new Date();
		newValues.in_process= 1;

		const conditions= {_id: id, in_process: 0};
		const doc= {$set: newValues};
		const options= {new: true, rawResult: true};
		// Notes: rawResult:true
		// - if changed, result: lastErrorObject: { updatedExisting: true, n: 1 }, value: <model w/ old/new {new:bool} record>
		// - if not chnaged: result is null

		logRequest(f, { conditions, doc, options } );
		return this._model.findOneAndUpdate(conditions, doc, options)
		.then(function(mongo_result){
			logResponse(f, mongo_result);
			if (mongo_result && ((mongo_result.lastErrorObject != null ? mongo_result.lastErrorObject.n : undefined) === 1)) { // We did update the record
				if (reread) { return [mongo_result.value.toJSON()]; } else { return {affectedRows: 1}; }
			} else {
				if (reread) { return []; } else { return {affectedRows: 0}; }
			}
		});
	}

	Fail(ctx, id, newValues, reread){
		if (reread == null) { reread = false; }
		const f= 'RunQueueMongoDbPersistence::Fail:';
		newValues= _.pick(newValues, 'last_reason', 'run_at');
		newValues.mo= new Date();
		newValues.in_process= 0;

		const doc= {$set: newValues, $inc: {retries: 1}, $unset: {fail_at: ''}};
		const options= {new: true, rawResult: true};

		logRequest(f, { id, doc, options } );
		return this._model.findByIdAndUpdate(id, doc, options)
		.then(function(mongo_result){
			logResponse(f, mongo_result);
			if (mongo_result && ((mongo_result.lastErrorObject != null ? mongo_result.lastErrorObject.n : undefined) === 1)) { // We did update the record
				if (reread) { return [mongo_result.value.toJSON()]; } else { return {affectedRows: 1}; }
			} else {
				if (reread) { return []; } else { return {affectedRows: 0}; }
			}
		});
	}

	RemoveByIds(ctx, ids){
		const f= 'RunQueueMongoDbPersistence::RemoveByIds:';
		if (!_.isArray(ids)) { ids= [ids]; }

		const conditions= {_id: {$in: ids}};
		const doc= {$set: {mo: new Date(), di: 1}};

		logRequest(f, { conditions, doc } );
		// When running updateMany, we can expect nModified to return the number of results modified.
		// This is in contrast to findByIdAndUpdate that just returns n.
		return this._model.updateMany(conditions, doc)
		.then(function(result){
			logResponse(f, result);
			return {affectedRows: result.nModified};
		}); 
	}


	RemoveByUniqueKeys(ctx, uniqueKeys){
		const f= 'RunQueueMongoDbPersistence::RemoveByUniqueKeys:';
		if (!_.isArray(uniqueKeys)) { uniqueKeys= [uniqueKeys]; }

		const conditions= {unique_key: {$in: uniqueKeys}};
		const doc= {$set: {mo: new Date(), di: 1}};

		logRequest(f, { conditions, doc } );
		// When running updateMany, we can expect nModified to return the number of results modified.
		// This is in contrast to findByIdAndUpdate that just returns n.
		return this._model.updateMany(conditions, doc)
		.then(function(result){
			logResponse(f, result);
			return {affectedRows: result.nModified};
		});
	}

	GetDelayedByTopic(ctx){
		const f= 'RunQueueMongoDbPersistence::GetDelayedByTopic:';
		const pipeline= [
			{ $match: {di: 0, in_process: 0, run_at: {$lte: new Date()}} },
			{ $group: {_id: "$topic", run_at: {$min: '$run_at'}} },
			{ $addFields: {delay: {$subtract: [ new Date(), "$run_at" ]}} }
		];

		logRequest(f, {pipeline});
		return this._model.aggregate(pipeline)
		.then(function(results){
		  	logResponse(f, results);
		  	return Array.from(results).map((r) => ({topic: r._id, delay: Math.floor(r.delay / 1000)}));
		});
	}

	GetRetriesByTopic(ctx){
		const f= 'RunQueueMongoDbPersistence::GetRetriesByTopic:';
		const pipeline= [
			{ $match: {di: 0, retries: {$gt: 0}} },
			{ $group: {_id: "$topic", max_retries: {$max: '$retries'}} }
		];

		logRequest(f, {pipeline});
		return this._model.aggregate(pipeline)
		.then(function(results){
		  	logResponse(f, results);
		  	return Array.from(results).map((r) => ({topic: r._id, max_retries: r.max_retries}));
		});
	}

	GetFailuresByTopic(ctx){
		const f= 'RunQueueMongoDbPersistence::GetFailuresByTopic:';
		const pipeline= [
			{ $match: {di: 0, in_process: 1, fail_at: {$lte: new Date()}} },
			{ $group: {_id: "$topic", failures: {$sum: 1}} }
		];

		logRequest(f, {pipeline});
		return this._model.aggregate(pipeline)
		.then(function(results){
		  	logResponse(f, results);
		  	return Array.from(results).map((r) => ({topic: r._id, failures: r.failures}));
		});
	}
}

module.exports= RunQueueMongoDbPersistence;
