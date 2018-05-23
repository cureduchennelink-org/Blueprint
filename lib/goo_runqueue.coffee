
_ = require 'lodash'

Promise= require 'bluebird'
mongoose= require 'mongoose'
mongoose.Promise= Promise

RunQueueMongoDbSchema= require './goo_schema_runqueue'
showme= (f, obj)->
	console.log "SHOWME: #{f} #{typeof obj} #{obj?.constructor?.name ? 'no-name'}",
		if obj? and typeof obj is 'object'
			keys: Object.keys obj
			funcs: (nm for nm,val of obj when typeof val is 'function').join()
			mongo_stuff: _.pick obj, 'lastErrorObject', 'value', 'ok'
			mongoose_stuff: _.pick obj, 'isNew', 'errors', '_doc'
		else {}

logRequest= (f, obj)->
	# The Query that is going to turn into a Mongoose Model
	console.log "##### QUERY >>>" + f, obj 

logResponse= (f, objs)->
	objs= [objs] unless Array.isArray(objs)
	console.log("##### RESP >>> " + f, length: objs.length)
	for obj in objs
		if obj?.toJSON?
			console.log " -#- ", obj.toJSON()
		else showme(" -#- ", obj)

class RunQueueMongoDbPersistence
	@deps= {}

	constructor: ->
		@_schema= new RunQueueMongoDbSchema()

	open: (uri)->
		new Promise (resolve, reject)=>
			mongoose.connect uri, (err)=> # Consider using .then, if supported
				if err then reject err
				@_connection= mongoose.connection
				@_model= mongoose.model 'RunQueue', @_schema
				resolve()


	close: ()->
		new Promise (resolve, reject)=>
			# Check if already closed
			if (@_model== null)
				return resolve()

			mongoose.disconnect (err)=>
				@_model= null
				if err then reject err else resolve()

	clear: ()-> @_model.remove {}

	GetJobById: (ctx, id)-> @_model.findById id

	GetPendingCnts: (ctx)->
		pipeline= [
			{ $match: in_process: 1, di: 0 }
			{ $group: _id: '$group_ref', count: $sum: 1 }
		]

		# TODO: COME BACK & REVISE 
		new Promise (resolve, reject)=>
			@_model.aggregate pipeline, (err, results)=> # TODO CONSIDER .THEN VERSION W/O THE NEW PROMISE
				if err then return reject err else if not results? then return resolve []
				resolve _.map results,  (r) =>
						group_ref: r._id, active_cnt: r.count

	GetNextJobs: (ctx, maxRows, maxRetries= 8)->
		f="RunQueueMongoDbPersistence::GetNextJobs: "
		date= new Date()
		oneSMore= new Date(date - 1000) # we need to get the date minus one second
		conditions=
			in_process: 0
			run_at: $lte: oneSMore   
			retries: $lte: maxRetries
			di: 0
		
		# Record the query that we're using
		logRequest(f, { conditions, maxRows })

		@_model
		.find conditions
		.sort priority: 1, run_at: 1
		.limit maxRows
		.then (model_result)->
			logResponse(f, model_result)
			model.toJSON() for model in model_result

	AddJob: (ctx, newValues, reread= false)->
		f= 'RunQueueMongoDbPersistence::AddJob:'
		newValues= _.pick newValues, 'unique_key', 'topic', 'group_ref', 'priority', 'run_at', 'json'
		_.merge newValues,
			mo: new Date()
			in_process: 0
			retries: 0
		newValues.in_process= 0
		options= {} # new: true # XXX, rawResult: true
		console.log f+ 'SAVE', {newValues, options}
		# XXX @_model.create newValues #, new: true, rawResult: true
		new @_model newValues
		.save options
		.then (model_result)-> # TODO 
			showme f, model_result
			if reread then [model_result.toJSON()] else affectedRows: 1, insertId: model_result.toJSON().id

	ReplaceJob: (ctx, id, newValues, reread= false)->
		f= 'RunQueueMongoDbPersistence::ReplaceJob:'
		# TODO CHECK THAT USING newValues ON LEFT SIDE IS CORRECT
		newValues= _.pick newValues, 'unique_key', 'priority', 'run_at', 'json'
		defaults= in_process: 0, retries: 0
		newValues= _.merge {}, defaults, newValues
		newValues.mo= new Date()

		unset= {}
		unset[ nm]= '' for nm in ['fail_at', 'last_reason', 'unique_key', 'json'] when nm not of newValues
		doc= $set: newValues, $unset: unset
		options= new: true, rawResult: true

		@_model.findByIdAndUpdate id, doc, options
		.then (mongo_result)->
			showme f, mongo_result
			if mongo_result and mongo_result.lastErrorObject?.n is 1 # We did update the record
				if reread then [mongo_result.value.toJSON()] else affectedRows: 1
			else
				if reread then [] else affectedRows: 0

	MarkJobPending: (ctx, id, otherValues, reread= false)->
		f= 'RunQueueMongoDbPersistence::MarkJobPending:'
		newValues= otherValues ? {}
		newValues= _.pick newValues, 'unique_key', 'priority', 'run_at', 'json', 'fail_at'
		newValues.mo= new Date()
		newValues.in_process= 1

		conditions= _id: id, in_process: 0
		doc= $set: newValues
		options= new: true, rawResult: true
		# Notes: rawResult:true
		# - if changed, result: lastErrorObject: { updatedExisting: true, n: 1 }, value: <model w/ old/new {new:bool} record>
		# - if not chnaged: result is null

		console.log '##### QUERY >>>', {conditions, doc, options}
		@_model.findOneAndUpdate conditions, doc, options
		.then (mongo_result)->
			showme f, mongo_result
			if mongo_result and mongo_result.lastErrorObject?.n is 1 # We did update the record
				if reread then [mongo_result.value.toJSON()] else affectedRows: 1
			else
				if reread then [] else affectedRows: 0

	Fail: (ctx, id, newValues, reread= false)->
		f= 'RunQueueMongoDbPersistence::Fail:'
		newValues= _.pick newValues, 'last_reason', 'run_at'
		newValues.mo= new Date()
		newValues.in_process= 0

		doc= $set: newValues, $inc: {retries: 1}, $unset: fail_at: ''
		options= new: true, rawResult: true

		@_model.findByIdAndUpdate id, doc, options
		.then (mongo_result)->
			showme f, mongo_result
			if mongo_result and mongo_result.lastErrorObject?.n is 1 # We did update the record
				if reread then [mongo_result.value.toJSON()] else affectedRows: 1
			else
				if reread then [] else affectedRows: 0

	RemoveByIds: (ctx, ids)->
		ids= [ids] unless _.isArray ids

		conditions= _id: $in: ids
		doc= $set: mo: new Date(), di: 1

		@_model.updateMany conditions, doc
		.then (result)->
			affectedRows: result.nModified 


	RemoveByUniqueKeys: (ctx, uniqueKeys)->
		uniqueKeys= [uniqueKeys] unless _.isArray uniqueKeys

		conditions= unique_key: $in: uniqueKeys
		doc= $set: mo: new Date(), di: 1

		@_model.updateMany conditions, doc
		.then (result)->
			affectedRows: result.nModified

	GetDelayedByTopic: (ctx)->
		pipeline= [
			{ $match: di: 0, in_process: 0, run_at: $lte: new Date() }
			{ $group: _id: "$topic", run_at: $min: '$run_at' }
			{ $addFields: delay: $subtract: [ new Date(), "$run_at" ] }
		]

		new Promise (resolve, reject)=>
			@_model.aggregate pipeline, (err, results)=>
				if err then return reject err else if not results? then return resolve []
				resolve _.map results, (r)=>
					topic: r._id,
					delay: Math.floor r.delay / 1000

	GetRetriesByTopic: (ctx)->
		pipeline= [
			{ $match: di: 0, retries: $gt: 0 }
			{ $group: _id: "$topic", max_retries: $max: '$retries' }
		]

		new Promise (resolve, reject)=>
			@_model.aggregate pipeline, (err, results)=>
				if err then return reject err else if not results? then return resolve []
				resolve _.map results, (r)=>
					topic: r._id,
					max_retries: r.max_retries

	GetFailuresByTopic: (ctx)->
		pipeline= [
			{ $match: di: 0, in_process: 1, fail_at: $lte: new Date() }
			{ $group: _id: "$topic", failures: $sum: 1 }
		]

		new Promise (resolve, reject)=>
			@_model.aggregate pipeline, (err, results)=>
				if err then return reject err else if not results? then return resolve []
				resolve _.map results, (r)=>
					topic: r._id,
					failures: r.failures

module.exports= RunQueueMongoDbPersistence
