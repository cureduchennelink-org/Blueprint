/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Push Service Module
//

const Q= require('q');
const E= require('./error');
const _= require('lodash');

let sdb= false;
let _log= false;

class Push {
	constructor(kit){
		this.S_Poll = this.S_Poll.bind(this);
		this.kit = kit;
		sdb=		kit.services.db.mysql;
		_log=		kit.services.logger.log;
		this.config= 	kit.services.config.push_service;
		this.util= 		kit.services.util;
		this.interval=  this.config.poll_interval; // TODO: change to @poll_interval
		this.interested_parties= []; // List of callbacks to call when changes are processed
		this.pset_by_name= {};
		this.count= 0;
		this.ctx= {conn: null, log: _log};
	}

	server_init(kit){
		const f= 'Push:server_init';

		return Q.resolve()
		.then(() => {

			// Acquire DB Connection
			return sdb.core.Acquire();
	}).then(c=> {
			return this.ctx.conn= c;
		});
	}

	// Called after all services and routes have been initialized
	server_start(kit){
		const f= 'Push:server_start';

		return Q.resolve()
		.then(()=> {

			// Read the latest item_change
			return sdb.pset_item_change.GetMostRecentChanges(this.ctx, 1);
	}).then(db_rows=> {
			_log.debug(f, 'got latest item_change', db_rows);
			if (db_rows.length) {
				this.count= db_rows[0].count;
			}

			// Read as far back as we have room in the buffer for
			if (!db_rows.length) { return []; }
			return sdb.pset_item_change.GetMostRecentChanges(this.ctx, this.config.max_buffer_size);
		}).then(db_rows=> {

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

	GetPushSet(ctx, clear_pset, nm){
		const f= 'Push:GetPushSet:';
		_log= ctx.log;
		_log.debug(f, {clear_pset}, nm);
		let pset_id= false;
		const pset= this.pset_by_name[nm] != null ? this.pset_by_name[nm] : false;
		if (pset && !clear_pset) { return pset; }

		return Q.resolve()
		.then(() =>

			// Acquire DB Connection
			sdb.core.Acquire()).then(function(c) {
			if (c !== false) { ctx.conn= c; }

			// Start a Transaction
			return sdb.core.StartTransaction(ctx);}).then(() =>

			// Grab the pset, or create one if it doesn't exist
			sdb.pset.read_or_insert(ctx, nm)).then(pset_rec=> {
			this.pset_by_name[nm]= new PushSet(pset_rec, this.util);
			pset_id= pset_rec.id;

			// if clear_pset is true remove all data related to pset id
			if (!clear_pset) { return false; }
			return this.S_CleanPushSet(ctx, pset_id);
		}).then(function(clean_result){
			_log.debug(f, 'got clean_result:', clean_result);

			// Commit the transaction
			return sdb.core.sqlQuery(ctx, 'COMMIT');}).then(db_result => {

			// Release DB Connection
			sdb.core.release(ctx.conn);

			return this.pset_by_name[nm];
		});
	}
			// return new PushSet rec or existing @pset_by_name[nm]
	Start(){ return this.timer= setTimeout(this.S_Poll, this.interval); }

	S_Poll(){
		const f= 'Push:Poll';
		const limit= this.config.poll_limit;
		const fromId= this.count;

		return Q.resolve()
		.then(()=> {

			// Read all pset_item_changes from last cursor
			return sdb.pset_item_change.GetNext(this.ctx, fromId, limit);
	}).then(db_rows=> {
			if (db_rows.length) {
				this.count= db_rows[db_rows.length - 1].count;
			}

			if (!db_rows.length) { return false; } // No Changes
			for (let cb of Array.from(this.interested_parties)) { cb(db_rows); }
			return null;
		}).then(()=> {

			// Restart the timer
			return this.timer= setTimeout(this.S_Poll, this.interval);
		}).fail(e=> _log.error(f, e, e.stack));
	}

	S_CleanPushSet(ctx, pset_id){
		const f= 'Push:S_CleanPushSet';
		_log= ctx.log;
		_log.debug(f, {pset_id});
		const item_ids= [];

		return Q.resolve()
		.then(()=>

			// Grab all pset_item id's related to this pset
			sdb.pset_item.get_by_psid(ctx, pset_id)).then(function(db_rows){
			_log.debug(f, 'got item ids:', db_rows);
			for (let row of Array.from(db_rows)) { item_ids.push(row.id); }

			// Remove all pset_item_changes in pset_item ids
			return sdb.pset_item_change.delete_items(ctx, item_ids);}).then(function(db_result){
			_log.debug(f, 'got delete changes:', db_result);

			// Remove all pset_items related to this pset
			return sdb.pset_item.delete_pset(ctx, pset_id);}).then(function(db_result){
			_log.debug(f, 'got delete items:', db_result);

			return true;
		});
	}
}

class PushSet {
	constructor(pset, util){ // pset: id= 10, name= 'Todo'
		this.pset = pset;
		this.util = util;
		this.c_items= {}; // Cached Push Set Items. indexed by 'xref'
	}

	ItemChange(ctx, xref, verb, prev, now, resource, tbl_id, tbl){
		const f= `PushSet:${this.pset.name}:ItemChange:`;
		_log= ctx.log;
		_log.debug(f, { xref, verb, resource, tbl_id, tbl });
		let pset_item_id= false;

		// Optimization to skip if prev and now are the same during update
		let [before, after]= Array.from(this.util.Diff(prev, now));
		_log.debug(f, { before, after});
		if ((_.isEmpty(after)) && (verb === 'update')) { return false; }

		return Q.resolve()
		.then(()=> {

			// Grab the pset_item's id
			return this.S_GetItem(ctx, xref);
	}).then(item_rec=> {
			_log.debug(f, { item_rec });
			pset_item_id= item_rec.id;

			// Lock the pset_item
			return sdb.pset_item.lock(ctx, pset_item_id);
		}).then(db_rows=> {
			if (db_rows.length !== 1) { throw new E.DbError('PUSHSET:ITEMCHANGE:BAD_LOCK'); }

			// Insert the change
			before= JSON.stringify(before);
			after= JSON.stringify(after);
			const new_change= { pset_id: this.pset.id, pset_item_id, verb, prev: before, after, resource, tbl_id, tbl };
			return sdb.pset_item_change.create(ctx, new_change);
		}).then(db_result=> {

			// Update pset_item count
			return sdb.pset_item.update_by_id(ctx, pset_item_id, {count: db_result.insertId});
		}).then(db_result=> {
			if (db_result.affectedRows !== 1) { throw new E.DbError('PUSHSET:ITEMCHANGE:UPDATE_COUNT'); }

			return null;
		});
	}
	GetPushHandle(ctx, xref){
		const f= `PushSet:${this.pset.name}:GetPushHandle:`;
		_log= ctx.log;
		let item= false;
		let item_change= false;

		return Q.resolve()
		.then(()=> {

			return this.S_GetItem(ctx, xref);
	}).then(item_rec=> {
			item= item_rec;

			return sdb.pset_item_change.GetMostRecentForItem(ctx, this.pset.id, item_rec.id);
		}).then(db_rows=> {
			if (!db_rows.length) { throw new E.ServerError("PUSHSET:GET_HANDLE:NO_LATEST_CHANGE"); }
			item_change= db_rows[0];

			return `${this.pset.id}/${item.id}/${item_change.id}`;
		});
	}

	// Return item handle to endpoint on behalf of client for websock call
	// Assumption: The caller will start a transaction
	S_GetItem(ctx, xref){
		const f= `PushSet:${this.pset.name}:S_GetItem:`;
		_log= ctx.log;
		_log.debug(f, xref);
		const sxref= (String(xref));
		const item= this.c_items[sxref] != null ? this.c_items[sxref] : false;
		if (item) { return item; } // Cached item

		return Q.resolve()
		.then(()=> {

			// Look for existing pset item in DB
			return sdb.pset_item.get_psid_xref(ctx, this.pset.id, sxref);
	}).then(db_rows=> {
			_log.debug(f, 'got pset_item:', db_rows);
			if (db_rows.length) {
				this.c_items[sxref]= db_rows[0];
				return false;
			}

			// If item doesn't exist. Call @S_CreateItem
			return this.S_CreateItem(ctx, sxref);
		}).then(new_handle=> {
			_log.debug(f, 'got new_handle:', new_handle);
			if (new_handle !== false) {
				this.c_items[sxref]= new_handle;
			}

			// Send back to client
			return this.c_items[sxref];
		});
	}
	S_CreateItem(ctx, xref){
		const f= `PushSet:${this.pset.name}:S_CreateItem:`;
		_log= ctx.log;
		_log.debug(f, xref);
		const pset_id= this.pset.id;
		let handle= false;

		return Q.resolve()
		.then(()=>

			// Insert in to pset_item table (@pset.id, xref)
			sdb.pset_item.create(ctx, { pset_id, xref }))
		.then(db_result=> {
			_log.debug(f, 'got create pset item result:', db_result);
			const id= db_result.insertId;

			// Re-Read the PSetItem
			return sdb.pset_item.get_by_id(ctx, id);
	}).then(db_rows=> {
			_log.debug(f, 'got re-read:', db_rows);
			if (db_rows.length !== 1) { throw new E.DbError('PUSHSET:CREATE_ITEM:REREAD'); }
			handle= db_rows[0];

			// Insert 'init' change record for the new pset_item
			const prev= {}; const after= {}; const resource= null; const tbl_id= null; const tbl= null;
			return this.ItemChange(ctx, xref, 'init', prev, after, resource, tbl_id, tbl);
		}).then(() => {

			// return insertId
			return handle;
		});
	}
}

exports.Push= Push;
