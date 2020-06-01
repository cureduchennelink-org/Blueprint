// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Mongoose Core Model Functions.
//

const Q= require('q');
const E= require('../../error');
const mongoose= require('mongoose');

const checkForHexRegExp= new RegExp("^[0-9a-fA-F]{24}$");

class MCore {
	constructor(log){
		this.log = log;
	}

	// Checks to see if n is a valid ObjectId
	isObjectId(n){ return checkForHexRegExp.test(n); }

	// Create and save a document
	// @param model 	- Mongoose Model Instance
	// @param vals 	- New Document Values
	// @return doc
	create(model, vals){ return Q.ninvoke(model, 'create', vals); }

	// Save a document
	// @param doc 	- The document instance to be saved
	// @return {doc, numberAffected}
	save(doc){
		return (Q.ninvoke(doc, 'save'))
		.then(result => ({
            doc: result[0],
            numberAffected: result[1]
        }));
	}

	// Save sub-doc to an array within a document
	// @param doc 	- instance of a document
	// @param arrayKey - Name of sub-document list to add to
	// @param sub_doc  - The sub document to add to the list
	// @return {doc, numberAffected, sub_doc}
	createSubDoc(doc, arrayKey, sub_doc){
		doc[arrayKey].push(sub_doc);
		return (Q.ninvoke(doc, 'save'))
		.then(result => ({
            doc: result[0],
            numberAffected: result[1],
            sub_doc
        }));
	}

	// Update a Collection
	// @param model 	- Collection Name
	// @param where 	- Update Criteria
	// @param set 	- Update Action
	// @param opts 	- Update Options (safe,upsert,multi,overwrite)
	// @return {numberAffected, raw}
	update(model, where, set, opts){
		if (!opts) { opts= {}; }
		return (Q.ninvoke(model, 'update', where, set, opts))
		.then(result => ({
            numberAffected: result[0],
            raw: result[1]
        }));
	}

	// Find and Update a document by _id
	// opts(default): new(true), upsert(false), sort, select
	findByIdAndUpdate(model, id, set, opts){
		if (!opts) { opts= {}; }
		return (Q.ninvoke(model, 'findByIdAndUpdate', id, set, opts))
		.then(new_doc => new_doc);
	}

	// Find multiple documents
	// @param model 	- Collection Name
	// @param opts 	- Query Criteria / Filters
	// @param pjn 	- Query Projection
	// @return docs
	find(model, opts, pjn){ return Q.ninvoke(model, 'find', opts, pjn); }

	// Find one document
	// @param model 	- Collection Name
	// @param opts 	- Query Options
	// @parma pjn 	- Query Projection
	// @return doc or null
	findOne(model, opts, pjn){ return Q.ninvoke(model, 'findOne', opts, pjn); }

	// Find one document by id
	// Returns a single doc or null
	findById(model, id){
		return (Q.ninvoke(model, 'findById', id))
		.then(doc => doc);
	}
}

exports.MCore= MCore;