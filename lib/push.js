// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Push Service Module
//

const Promise= require('bluebird');
const _= require('lodash');

class Push {
	static initClass() {
		this.deps= {
			mysql: ['pset','pset_item','pset_item_change'], services: ['error','util'],
			config: 'push_service[poll_interval,max_buffer_size,poll_limit]'
		};
	}
	constructor(kit){
		this.S_Poll = this.S_Poll.bind(this);
		const f= 'BL/Push.constructor:';
		this.config= 	kit.services.config.push_service;
		this.E=			kit.services.error;
		this.sdb=		kit.services.db.psql;
		this.util= 		kit.services.util;
		this.interval=  this.config.poll_interval; // TODO: change to @poll_interval
		this.interested_parties= []; // List of callbacks to call when changes are processed
		this.pset_by_name= {};
		this.count= 0;
		this.ctx= {conn: null, log: kit.services.logger.log};
	}

	server_init(kit){
		const f= 'Push:server_init';

		return Promise.resolve().bind(this)
		.then(function() {

			// Acquire DB Connection
			return this.sdb.core.Acquire();}).then(function(c){
			return this.ctx.conn= c;
		});
	}

	// Called after all services and routes have been initialized
	server_start(kit){
		const f= 'Push:server_start';

		return Promise.resolve().bind(this)
		.then(function() {

			// Read the latest item_change
			console.log(f, this.sdb)
			return this.sdb.pset_item_change.GetMostRecentChanges(this.ctx, 1);}).then(function(db_rows){
			this.ctx.log.debug(f, 'got latest item_change', db_rows);
			if (db_rows.length) {
				this.count= db_rows[0].count;
			}

			// Read as far back as we have room in the buffer for
			if (!db_rows.length) { return []; }
			return this.sdb.pset_item_change.GetMostRecentChanges(this.ctx, this.config.max_buffer_size);}).then(db_rows=> {

			// Update all interested parties w/ most recent changes
			if (!db_rows.length) { return false; } // No Changes
			for (let cb of Array.from(this.interested_parties)) { cb(db_rows); }
			return null;
		}).then(()=> {

			// Start the Poller
			return this.Start();
		});
	}

	RegisterForChanges(cb){ return this.interested_parties.push(cb); }

	GetPushSet(clear_pset, nm){
		const f= 'Push:GetPushSet:';
		this.ctx.log.debug(f, {clear_pset}, nm);
		let pset_id= false;
		const pset= this.pset_by_name[nm] != null ? this.pset_by_name[nm] : false;
		if (pset && !clear_pset) { return pset; }

		return Promise.resolve().bind(this)
		.then(function() {

			// Grab the pset, or create one if it doesn't exist
			return this.sdb.pset.read_or_insert(this.ctx, nm);}).then(function(pset_rec){
			this.pset_by_name[nm]= new PushSet(this.E, this.sdb, pset_rec, this.util);
			pset_id= pset_rec.id;

			// if clear_pset is true remove all data related to pset id
			if (!clear_pset) { return false; }
			return this.S_CleanPushSet(this.ctx, pset_id);}).then(function(clean_result){
			this.ctx.log.debug(f, 'got clean_result:', clean_result);

			// return new PushSet rec or existing @pset_by_name[nm]
			return this.pset_by_name[nm];});
	}

	Start(){ return this.timer= setTimeout(this.S_Poll, this.interval); }

	S_Poll(){
		const f= 'Push:Poll';
		const limit= this.config.poll_limit;
		const fromId= this.count;

		return Promise.resolve().bind(this)
		.then(function() {

			// Read all pset_item_changes from last cursor
			return this.sdb.pset_item_change.GetNext(this.ctx, fromId, limit);}).then(function(db_rows){
			if (db_rows.length) {
				this.count= db_rows[db_rows.length - 1].count;
			}

			if (!db_rows.length) { return false; } // No Changes
			for (let cb of Array.from(this.interested_parties)) { cb(db_rows); }
			return null;}).then(function() {

			// Restart the timer
			return this.timer= setTimeout(this.S_Poll, this.interval);}).catch(function(e){
			return this.ctx.log.error(f, e, e.stack);
		});
	}

	S_CleanPushSet(ctx, pset_id){
		const f= 'Push:S_CleanPushSet';
		ctx.log.debug(f, {pset_id});
		const item_ids= [];

		return Promise.resolve().bind(this)
		.then(function(){

			// Grab all pset_item id's related to this pset
			return this.sdb.pset_item.get_by_psid(ctx, pset_id);}).then(function(db_rows){
			ctx.log.debug(f, 'got item ids:', db_rows);
			for (let row of Array.from(db_rows)) { item_ids.push(row.id); }

			// Remove all pset_item_changes in pset_item ids
			return this.sdb.pset_item_change.delete_items(ctx, item_ids);}).then(function(db_result){
			ctx.log.debug(f, 'got delete changes:', db_result);

			// Remove all pset_items related to this pset
			return this.sdb.pset_item.delete_pset(ctx, pset_id);}).then(function(db_result){
			ctx.log.debug(f, 'got delete items:', db_result);

			return true;
		});
	}
}
Push.initClass();

class PushSet {
	constructor(E, sdb, pset, util){ // pset: id= 10, name= 'Todo'
		this.E = E;
		this.sdb = sdb;
		this.pset = pset;
		this.util = util;
		this.c_items= {}; // Cached Push Set Items. indexed by 'xref'
	}

	ItemChange(ctx, xref, verb, prev, now, resource, tbl_id, tbl){
		const f= `PushSet:${this.pset.name}:ItemChange:`;
		ctx.log.debug(f, { xref, verb, resource, tbl_id, tbl });
		let pset_item_id= false;

		// Optimization to skip if prev and now are the same during update
		let [before, after]= Array.from(this.util.Diff(prev, now));
		ctx.log.debug(f, { before, after});
		if ((_.isEmpty(after)) && (verb === 'update')) { return false; }

		return Promise.resolve().bind(this)
		.then(function() {

			// Grab the pset_item's id
			return this.S_GetItem(ctx, xref);}).then(function(item_rec){
			ctx.log.debug(f, { item_rec });
			pset_item_id= item_rec.id;

			// Lock the pset_item
			return this.sdb.pset_item.lock(ctx, pset_item_id);}).then(function(db_rows){
			if (db_rows.length !== 1) { throw new this.E.DbError('PUSHSET:ITEMCHANGE:BAD_LOCK'); }

			// Insert the change
			before= JSON.stringify(before);
			after= JSON.stringify(after);
			const new_change= { pset_id: this.pset.id, pset_item_id, verb, prev: before, after, resource, tbl_id, tbl };
			return this.sdb.pset_item_change.create(ctx, new_change);}).then(function(db_result){

			// Update pset_item count
			return this.sdb.pset_item.update_by_id(ctx, pset_item_id, {count: db_result.insertId});}).then(function(db_result){
			if (db_result.affectedRows !== 1) { throw new this.E.DbError('PUSHSET:ITEMCHANGE:UPDATE_COUNT'); }

			return null;
		});
	}

	GetPushHandle(ctx, xref){
		const f= `PushSet:${this.pset.name}:GetPushHandle:`;
		let item= false;
		let item_change= false;

		return Promise.resolve().bind(this)
		.then(function() {

			return this.S_GetItem(ctx, xref);}).then(function(item_rec){
			item= item_rec;

			return this.sdb.pset_item_change.GetMostRecentForItem(ctx, this.pset.id, item.id);}).then(function(db_rows){
			if (!db_rows.length) { throw new this.E.ServerError("PUSHSET:GET_HANDLE:NO_LATEST_CHANGE", `${this.pset.id}/${item.id}/?`); }
			item_change= db_rows[0];

			return `${this.pset.id}/${item.id}/${item_change.id}`;
		});
	}

	// Return item handle to endpoint on behalf of client for websock call
	// Assumption: The caller will start a transaction
	S_GetItem(ctx, xref){
		const f= `PushSet:${this.pset.name}:S_GetItem:`;
		ctx.log.debug(f, xref);

		const sxref= (String(xref));
		const item= this.c_items[sxref] != null ? this.c_items[sxref] : false;
		if (item) { return item; } // Cached item

		return Promise.resolve().bind(this)
		.then(function() {

			// Look for existing pset item in DB
			return this.sdb.pset_item.get_psid_xref(ctx, this.pset.id, sxref);}).then(function(db_rows){
			ctx.log.debug(f, 'got pset_item:', db_rows);
			if (db_rows.length) {
				this.c_items[sxref]= db_rows[0];
				return false;
			}

			// If item doesn't exist. Call @S_CreateItem
			return this.S_CreateItem(ctx, sxref);}).then(function(new_handle){
			ctx.log.debug(f, 'got new_handle:', new_handle);
			if (new_handle !== false) {
				this.c_items[sxref]= new_handle;
			}

			// Send back to client
			return this.c_items[sxref];});
	}

	S_CreateItem(ctx, xref){
		const f= `PushSet:${this.pset.name}:S_CreateItem:`;
		ctx.log.debug(f, xref);
		const pset_id= this.pset.id;
		let handle= false;

		return Promise.resolve().bind(this)
		.then(function() {

			// Insert in to pset_item table (@pset.id, xref)
			return this.sdb.pset_item.create(ctx, { pset_id, xref });})
		.then(function(db_result){
			ctx.log.debug(f, 'got create pset item result:', db_result);
			const id= db_result.insertId;

			// Re-Read the PSetItem
			return this.sdb.pset_item.get_by_id(ctx, id);}).then(function(db_rows){
			ctx.log.debug(f, 'got re-read:', db_rows);
			if (db_rows.length !== 1) { throw new this.E.DbError('PUSHSET:CREATE_ITEM:REREAD'); }
			handle= db_rows[0];

			// Insert 'init' change record for the new pset_item
			const prev= {}; const after= {}; const resource= null; const tbl_id= null; const tbl= null;
			return this.ItemChange(ctx, xref, 'init', prev, after, resource, tbl_id, tbl);}).then(() => // return insertId
        handle);
	}
}

exports.Push= Push;
