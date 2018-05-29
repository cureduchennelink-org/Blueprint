
mongoose= require "mongoose"

RunQueueMongoDbSchema= ->

	schema= new mongoose.Schema
		#_id: type: String
		di:           type: Number, required: true, enum: [0, 1, 2], default: 0 # 0 none, 1 disabled, 2 purge
		cr:           type: Date,   required: true, default: Date.now
		mo:           type: Date,   required: true, default: Date.now
		unique_key:   type: String, required: false, default: null, unique: true

		topic:        type: String, required: false
		group_ref:    type: String, required: false
		in_process:   type: Number, required: true, enum: [0, 1], default: 0 # 0 not running, 1 running
		priority:     type: Number, required: true, default: 1000
		run_at:       type: Date,   required: false
		retries:      type: Number, required: true, default: 0
		fail_at:      type: Date,   required: false
		last_reason:  type: String, required: false

		json:         type: String, required: false
	,
		collection: 'runqueue'
		autoIndex: true

	schema.index priority: 1, run_at: 1

	schema.set 'toJSON',
		transform: (doc, ret)->
			ret.id= ret._id
			delete ret._id
			delete ret.__v
			return ret

	return schema

module.exports = RunQueueMongoDbSchema
