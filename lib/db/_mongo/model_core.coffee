#
#	Mongoose Core Model Functions.
#

Q= require 'q'
E= require '../../error'

class MCore
	constructor: (@log)->

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
	find: (model, opts)->
		(Q.ninvoke model, 'find', opts)
		.then (docs)-> docs

	# Find one document
	# Returns a single doc or null
	findOne: (model, opts)->
		(Q.ninvoke model, 'findOne', opts)
		.then (doc)-> doc

	# Find one document by id
	# Returns a single doc or null
	findById: (model, id)->
		(Q.ninvoke model, 'findById', id)
		.then (doc)-> doc

exports.MCore= MCore