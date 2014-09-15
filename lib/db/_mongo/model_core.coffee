#
#	Mongoose Core Model Functions.
#

Q= require 'q'
E= require '../../error'
mongoose= require 'mongoose'

checkForHexRegExp= new RegExp("^[0-9a-fA-F]{24}$")

class MCore
	constructor: (@log)->

	# Checks to see if n is a valid ObjectId
	isObjectId: (n)->
		checkForHexRegExp.test n

	# Create and save a document
	# Returns the new doc
	create: (model, opts)->
		(Q.ninvoke model, 'create', opts)
		.then (doc)-> doc

	# Save a document
	save: (doc)=>
		(Q.ninvoke doc, 'save')
		.then -> null

	# Update a document
	# Returns numberAffected, raw
	# opts(default):safe(schema), upsert(false), multi(false), strict(schema)
	update: (model, where, set, opts)->
		opts= {} if not opts
		(Q.ninvoke doc, 'update', where, set, opts)
		.then (numberAffected, raw)->
			numberAffected: numberAffected, raw: raw

	# Find and Update a document
	# opts(default): new(true), upsert(false), sort, select
	findByIdAndUpdate: (id, set, opts)->
		opts= {} if not opts
		(Q.ninvoke doc, 'findByIdAndUpdate', id, set, opts)
		.then (new_doc)-> new_doc

	# Find multiple documents
	# Returns an array of docs (possibly empty)
	find: (model, opts, pjn)->
		(Q.ninvoke model, 'find', opts, pjn)
		.then (docs)-> docs

	# Find one document
	# Returns a single doc or null
	findOne: (model, opts, pjn)->
		(Q.ninvoke model, 'findOne', opts, pjn)
		.then (doc)-> doc

	# Find one document by id
	# Returns a single doc or null
	findById: (model, id)->
		(Q.ninvoke model, 'findById', id)
		.then (doc)-> doc

exports.MCore= MCore