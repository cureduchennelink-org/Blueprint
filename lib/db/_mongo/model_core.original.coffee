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
	isObjectId: (n)-> checkForHexRegExp.test n

	# Create and save a document
	# @param model 	- Mongoose Model Instance
	# @param vals 	- New Document Values
	# @return doc
	create: (model, vals)-> Q.ninvoke model, 'create', vals

	# Save a document
	# @param doc 	- The document instance to be saved
	# @return {doc, numberAffected}
	save: (doc)->
		(Q.ninvoke doc, 'save')
		.then (result)-> {doc: result[0], numberAffected: result[1]}

	# Save sub-doc to an array within a document
	# @param doc 	- instance of a document
	# @param arrayKey - Name of sub-document list to add to
	# @param sub_doc  - The sub document to add to the list
	# @return {doc, numberAffected, sub_doc}
	createSubDoc: (doc, arrayKey, sub_doc)->
		doc[arrayKey].push sub_doc
		(Q.ninvoke doc, 'save')
		.then (result)-> {doc: result[0], numberAffected: result[1], sub_doc}

	# Update a Collection
	# @param model 	- Collection Name
	# @param where 	- Update Criteria
	# @param set 	- Update Action
	# @param opts 	- Update Options (safe,upsert,multi,overwrite)
	# @return {numberAffected, raw}
	update: (model, where, set, opts)->
		opts= {} if not opts
		(Q.ninvoke model, 'update', where, set, opts)
		.then (result)-> { numberAffected: result[0], raw: result[1] }

	# Find and Update a document by _id
	# opts(default): new(true), upsert(false), sort, select
	findByIdAndUpdate: (model, id, set, opts)->
		opts= {} if not opts
		(Q.ninvoke model, 'findByIdAndUpdate', id, set, opts)
		.then (new_doc)-> new_doc

	# Find multiple documents
	# @param model 	- Collection Name
	# @param opts 	- Query Criteria / Filters
	# @param pjn 	- Query Projection
	# @return docs
	find: (model, opts, pjn)-> Q.ninvoke model, 'find', opts, pjn

	# Find one document
	# @param model 	- Collection Name
	# @param opts 	- Query Options
	# @parma pjn 	- Query Projection
	# @return doc or null
	findOne: (model, opts, pjn)-> Q.ninvoke model, 'findOne', opts, pjn

	# Find one document by id
	# Returns a single doc or null
	findById: (model, id)->
		(Q.ninvoke model, 'findById', id)
		.then (doc)-> doc

exports.MCore= MCore