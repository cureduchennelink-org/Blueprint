// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise= require('bluebird');
const mysql= require('mysql');
const _= require('lodash');

let db= false; // Singleton
exports.Instance= function(config){
	if (db !== false) { return db; }
	console.log('Connecting to DB...', {config});
	db= new Db(config);
	return db;
};

// Databse Abrstration Object
class Db {
	constructor(config){
		this.SqlQuery = this.SqlQuery.bind(this);
		this.GetByKey = this.GetByKey.bind(this);
		this.PutByKey = this.PutByKey.bind(this);
		this.config = config;
		this.conn= mysql.createConnection(this.config.pool);
	}

	End(){ this.conn.end; return this.conn= null; }
	SqlQuery(sql, args){
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
	GetOne(table, id){
		return Promise.resolve().bind(this)
		.then(function() {

			const sql= 'SELECT * FROM '+ table+ ' WHERE id= ? AND di= 0';
			return this.SqlQuery(sql, [id]);})
		.then(db_rows => db_rows[0]);
	}

	// Inserts one record in to the database
	// Returns the full record that was inserted
	InsertOne(table, new_values, reread){
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
	DeleteByKey(table, key, values){
		return Promise.resolve().bind(this)
		.then(function() {

			const sql= 'DELETE FROM '+ table+
				  ' where '+ key+ ' IN (?)';
			const args= [values];
			return this.SqlQuery(sql, args);}).then(db_result => db_result);
	}

	GetByKey(table, key, vals){
		if (!vals) { throw new Error('EMPTY_VALS'); }
		const vals_type= typeof vals;

		return Promise.resolve().bind(this)
		.then(function() {

			const args= ['number','string'].includes(vals_type) ? [[vals]] : [vals];
			const sql= 'SELECT * FROM '+ table+
				' WHERE di= 0 AND '+ key+ ' IN (?)';
			return this.SqlQuery(sql, args);}).then(db_rows => db_rows);
	}

	PutByKey(table, key, key_val, vals){
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
