// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Push Set Database Functions
//
const Promise= require('bluebird');

class SqlPSet {
	static initClass() {
		this.deps= {services: ['error','logger']};
	}
	constructor(core, kit){
		this.log= kit.services.logger.log;
		this.E= kit.services.error;
		this.db= core;
		this.table= 'psets';
		this.schema= {
			create: ['name'],
			get_by_id: ['*']
		};
		this.db.method_factory(this, 'SqlPSet');
	}

	get_by_name(ctx, name){
		const f= "DB:SqlPushSet:get_by_name:";
		this.log.debug(f, name);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT * FROM ${this.table} WHERE name= ? AND di= 0\
`;
			return this.db.sqlQuery(ctx, sql, [name]);})
		.then(db_rows => db_rows);
	}

	read_or_insert(ctx, name){
		const f= "DB:SqlPushSet:read_or_insert:";
		const _log= ctx.log;
		_log.debug(f, name);
		let existing_pset= false;

		return Promise.resolve().bind(this)
		.then(function() {

			// Look for existing PSet
			return this.get_by_name(ctx, name);}).then(function(db_rows){
			_log.debug(f, 'got existing PSet:', db_rows);
			if (db_rows.length > 0) {
				existing_pset= db_rows[0];
			}

			// Create new PSet if one doesn't exist
			if (existing_pset) { return false; }
			return this.create(ctx, {name});}).then(function(db_result){
			_log.debug(f, 'got create PSet result:', db_result);
			if (db_result === false) { return false; }
			const id= db_result.insertId;

			// Re-Read the PSet to get the full record
			return this.get_by_id(ctx, id);}).then(function(db_rows){
			_log.debug(f, 'got re-read:', db_rows);
			if (db_rows !== false) {
				if (db_rows.length !== 1) { throw new this.E.DbError('DB:PUSHSET:REREAD'); }
				existing_pset= db_rows[0];
			}

			return existing_pset;
		});
	}
}
SqlPSet.initClass();

exports.SqlPSet= SqlPSet;

class SqlPSetItem {
	constructor(core, kit){
		this.log= kit.services.logger.log;
		this.db= core;
		this.table= 'pset_items';
		this.schema= {
			create: ['pset_id', 'xref'],
			get_by_id: ['*'],
			id_xref: ['*'],
			get_psid: ['*'],
			update_by_id: ['count']
		};
		this.db.method_factory(this, 'SqlPSetItem');
	}

	lock(ctx, id){
		const f= "DB:SqlPSetItem:lock:";
		const _log= ctx.log;
		_log.debug(f, id);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT id FROM ${this.table}
WHERE id= ? AND di= 0 FOR UPDATE\
`;
			return this.db.sqlQuery(ctx, sql, [id]);})
		.then(db_rows => db_rows);
	}

	get_psid_xref(ctx, pset_id, xref){
		const f= "DB:SqlPSetItem:get_id_xref:";
		const _log= ctx.log;
		_log.debug(f, pset_id, xref);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT ${this.schema.id_xref.join(',')} 
FROM ${this.table}
WHERE pset_id= ? AND xref= ? AND di= 0\
`;
			return this.db.sqlQuery(ctx, sql, [pset_id, xref]);})
		.then(db_rows => db_rows);
	}

	get_by_psid(ctx, pset_id){
		const f= "DB:SqlPSetItem:get_by_psid:";
		const _log= ctx.log;
		_log.debug(f, pset_id);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT ${this.schema.get_psid.join(',')}
FROM ${this.table}
WHERE pset_id= ? AND di= 0\
`;
			return this.db.sqlQuery(ctx, sql, [pset_id]);})
		.then(db_rows => db_rows);
	}

	delete_pset(ctx, pset_id){
		const f= "DB:SqlPSetItem:delete_pset:";
		const _log= ctx.log;
		_log.debug(f, pset_id);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
DELETE FROM ${this.table}
WHERE pset_id= ?\
`;
			return this.db.sqlQuery(ctx, sql, [ pset_id ]);})
		.then(db_rows => db_rows);
	}
}

exports.SqlPSetItem= SqlPSetItem;

class SqlPSetItemChange {
	constructor(core, kit){
		this.log= kit.services.logger.log;
		this.db= core;
		this.table= 'pset_item_changes';
		this.schema= {
			recent: ['*'],
			create: ['pset_id','pset_item_id','verb','tbl','tbl_id','prev','after','resource'],
			next: ['id as count','pset_id','pset_item_id','tbl_id as id','verb','resource','prev','after']
		};
		this.db.method_factory(this, 'SqlPSetItemChange');
	}

	delete_items(ctx, item_ids){
		const f= "DB:SqlPSetItemChange:delete_items:";
		const _log= ctx.log;
		_log.debug(f, item_ids);
		if (!item_ids.length) { return {affectedRows: 0}; }

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
DELETE FROM ${this.table}
WHERE pset_item_id IN (?)\
`;
			return this.db.sqlQuery(ctx, sql, [ item_ids ]);})
		.then(db_result => db_result);
	}

	// Grabs the last record inserted for a particular pset/item
	GetMostRecentForItem(ctx, pset_id, pset_item_id){
		const f= "DB:SqlPSetItemChange:GetMostRecentForItem:";
		ctx.log.debug(f);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT ${this.schema.recent.join(',')}
FROM ${this.table}
WHERE di= 0 AND pset_id= ? AND pset_item_id= ?
ORDER BY id DESC LIMIT 1\
`;
			return this.db.sqlQuery(ctx, sql, [ pset_id, pset_item_id]);})
		.then(db_rows => db_rows);
	}

	// Grabs the last N recent changes
	GetMostRecentChanges(ctx, limit){
		const f= "DB:SqlPSetItemChange:GetMostRecentChanges:";
		ctx.log.debug(f);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT ${this.schema.next.join(',')}
FROM (SELECT * FROM ${this.table}
	  WHERE di= 0
	  ORDER BY id DESC LIMIT ?) sub
ORDER BY id ASC\
`;
			return this.db.sqlQuery(ctx, sql, [ limit]);})
		.then(db_rows => db_rows);
	}

	// Get the next set of pset item changes
	// from: the id that you would like to start getting changes from
	// limit: how many records you want to limit the response to
	GetNext(ctx, from, limit){
		const f= "DB:SqlPSetItemChange:GetNext:";
		const args= [];
		let sql_from= '';
		let sql_limit= '';

		if (typeof from === 'number') {
			sql_from= ' AND id > ?';
			args.push(from);
		}

		if (typeof limit === 'number') {
			sql_limit= 'LIMIT ?';
			args.push(limit);
		}

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT ${this.schema.next.join(',')}
FROM ${this.table}
WHERE di= 0 ${sql_from} 
ORDER BY count ${sql_limit}\
`;
			return this.db.sqlQuery(ctx, sql, args);}).then(db_rows => db_rows);
	}
}

exports.SqlPSetItemChange= SqlPSetItemChange;
