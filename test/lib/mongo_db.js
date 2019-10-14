// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

const Promise= require('bluebird');
const {MongoClient}= require('mongodb');
const _= require('lodash');

let db= false; // Singleton
exports.Instance= function(config){
	if (db !== false) { return db; }
	console.log('Connecting to DB... (as promise w/open)', {config});
	return Promise.resolve().bind(this)
	.then(() => db= new Db(config)).then(() => db.open()).then(() => db);
};

// Databse Abrstration Object
class Db {
	constructor(config){
		this.xSqlQuery = this.xSqlQuery.bind(this);
		this.xGetByKey = this.xGetByKey.bind(this);
		this.xPutByKey = this.xPutByKey.bind(this);
		this.config = config;
		this.db= false;
		this.log= console;
	}

	open() {
		const f= 'TEST:Db.open:';
		this.log.debug(f+ 'TOP', {});
		return Promise.resolve().bind(this)
		.then(function() {
			this.log.debug(f+ 'connect', {config: this.config});
			return MongoClient.connect(this.config);}).then(function(client){
			let nm, val;
			const mdb= client.db('test'); // JCS: NEW IN 3x IF YOU WERE USING 2x (RETURNS THE CLIENT NOT THE DB OF THE CLIENT)
			this.log.debug(f+ 'connect-result', {mdb, keys: Object.keys(mdb)});
			this.log.debug(f+ 'connect-result', {functions: ((() => {
				const result = [];
				for (nm in mdb) {
					val = mdb[nm];
					if (typeof val === 'function') {
						result.push(nm);
					}
				}
				return result;
			})())});

			this.log.debug(f+ 'mdb', _.pick(mdb, ['databaseName','options']));
			if ((mdb == null)) { throw new Error(f+ 'MongoDB connection is empty'); } // Why does MongoDB need this check?
			this.db= mdb;
			this.runqueue= mdb.collection('runqueue'); // Might not exist yet?
			this.log.debug(f+ 'collection-runqueue', this.runqueue);
			this.log.debug(f+ 'collection-runqueue-keys', {runqueue: this.runqueue, keys: Object.keys(this.runqueue)});
			return this.log.debug(f+ 'collection-runqueue-funcs', {functions: ((() => {
				const result1 = [];
				for (nm in this.runqueue) {
					val = this.runqueue[nm];
					if (typeof val === 'function') {
						result1.push(nm);
					}
				}
				return result1;
			})())});});
	}

	delete(collection, query_doc){
		console.log("\n----COLLECTION----> ", collection, typeof this[collection]);
		console.log("\n----QUERY_DOC----> ", query_doc);
		return this[collection].deleteMany(query_doc)
		.then(function(result){
			console.log('----RESULT-> ', result.result);
			return result.result;
		});
	}

	xEnd(){ this.conn.end; return this.conn= null; }
	xSqlQuery(sql, args){
		console.log("\n----SQL----> ", sql);
		if (args) { console.log('----ARGS---> ', (JSON.stringify(args))); }
		if (this.conn === null) { throw new E.DbError('DB:SQL:BAD_CONN'); }
		//console.log '----RUN--... '
		const p_query= Promise.promisify(this.conn.query, {context: this.conn});
		return (p_query(sql, args)).bind(this)
		.then(function(just_rows) {
			console.log('----RESULT-> ', 'affectedRows' in just_rows ? (JSON.stringify(just_rows)) : just_rows);
			return just_rows;
		});
	}
//.catch (e) ->
//console.log '----FAIL---> ', e
//throw e

	// Grabs an entire record by id
	xGetOne(table, id){
		return Promise.resolve().bind(this)
		.then(function() {

			const sql= 'SELECT * FROM '+ table+ ' WHERE id= ? AND di= 0';
			return this.SqlQuery(sql, [id]);})
		.then(db_rows => db_rows[0]);
	}

	// Inserts one record in to the database
	// Returns the full record that was inserted
	xInsertOne(table, new_values, reread){
		return Promise.resolve().bind(this)
		.then(function() {

			const cols= ['cr']; const qs= ['?']; const arg= [null];
			for (let nm in new_values) { const val = new_values[nm]; cols.push(nm); qs.push('?'); arg.push(val); }
			const sql= 'INSERT INTO '+ table+ ' ('+ (cols.join(','))+
				 ') VALUES ('+ (qs.join(','))+ ')';
			return this.SqlQuery(sql, arg);}).then(function(db_result){

			if (reread === false) { return db_result; }
			return this.GetOne(table, db_result.insertId);}).then(rec => rec);
	}

	// Deletes records from the database where the column
	// 'key' matches values in the 'values' array
	xDeleteByKey(table, key, values){
		return Promise.resolve().bind(this)
		.then(function() {

			const sql= 'DELETE FROM '+ table+
				  ' where '+ key+ ' IN (?)';
			const args= [values];
			return this.SqlQuery(sql, args);}).then(db_result => db_result);
	}

	xGetByKey(table, key, vals){
		if (!vals) { throw new Error('EMPTY_VALS'); }
		const vals_type= typeof vals;

		return Promise.resolve().bind(this)
		.then(function() {

			const args= ['number','string'].includes(vals_type) ? [[vals]] : [vals];
			const sql= 'SELECT * FROM '+ table+
				' WHERE di= 0 AND '+ key+ ' IN (?)';
			return this.SqlQuery(sql, args);}).then(db_rows => db_rows);
	}

	xPutByKey(table, key, key_val, vals){
		if (typeof vals !== 'object') { throw new Error('OBJECT_VALS'); }

		return Promise.resolve().bind(this)
		.then(function() {

			const vals_stuff= [];
			const args= [];
			for (let nm in vals) { vals_stuff.push(` ${nm} = ?`); args.push(vals[ nm]); }
			args.push(key_val);
			const sql= 'UPDATE '+ table+
				' SET '+ (vals_stuff.join(','))+
				' WHERE di= 0 AND '+ key+ ' = ?';
			return this.SqlQuery(sql, args);}).then(db_rows => db_rows);
	}
}
