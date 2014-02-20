#
#	MongoDB Model Schema Definitions
#

Q= require 'q'
mongoose= require 'mongoose'

# Definition
schema=
	name:
		type: String, 	required: true, index: unique: true, trim: true
	type:
		type: String,	requried: true
	description:
		type: String, 	required: true
	date_created:
		type: Date, 	required: true, default: Date.now

options=
	autoIndex: true 	# False is Best Practice for Production Env
	id: true			# Default id getter function toggle
	_id: true			# Use _id toggle
	safe: true			# Return Errors to callbacks
	strict: true		# Ignore unknown Schema values
#	capped: 1024 		# Maximum size of the collection in bytes
#	collection: 'name'	# Override the collection name
#	shardKey:			# sharded architecture
#	versionKey: _ver	# Defaults to __v
#	toJSON:				# toJSON behavior
#	toObject:			# toObject behavior

# Compile Schema Object
workoutSchema= new mongoose.Schema schema, options

# Instance Methods (Document Methods)
workoutSchema.methods.findSimilarTypes= (cb)->
	return this.model('workout').find {type: this.type}, cb
workoutSchema.methods.FindSimilarTypes= ()->
	Q.ninvoke this.model('workout'), 'find', type: this.type

# Statics (Model Methods)
workoutSchema.statics.FindByName= (name)->
	Q.ninvoke this, 'find', name: new RegExp name, 'i'

# Virtuals
workoutSchema.virtual('typeName').get ()->
	this.type + '-' + this.name

workoutSchema.virtual('typeName').set (typeName)->
	split= typeName.split '-'
	this.type= split[0] # persisted if saved
	this.name= split[1] # persisted if saved

# I/F: Compile Model Object
module.exports= mongoose.model 'workout', workoutSchema