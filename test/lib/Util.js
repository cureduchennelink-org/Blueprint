/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Q= 		require('q');
const _= 		require('lodash');
const http= 	require('http');
const mysql= 	require('mysql');
const config= (require('../../config'))();

if (!config.db.mysql.enable) { throw new Error('MYSQL NOT ENABLED'); }
config.db.mysql.pool.database+= '_test'; // TODO: Move to config file?
config.log= {name: 'test', level: 'info'};
exports.config= config;


// Share a single connection between all test suites
// Query the databse
// Create data in the database
// Cleanup data in the database (optional param?)

exports.test_ident_id= 97; // SYSTEM - TEST ident rec id
exports.rename= name=> `bp-${name}${new Date().getTime()}`;
exports.encryptedPassword= 'xfGuZKjVkoNgQyXxYT8+Hg==.f+uw2I+dqzfOE4O82Znikrbdb0lOONBxl/xcWGsQtFI=';

class Db {
	constructor(config1){
		this.SqlQuery = this.SqlQuery.bind(this);
		this.config = config1;
		this.conn= mysql.createConnection(this.config.pool);
	}

	End(){ this.conn.end; return this.conn= null; }
	SqlQuery(sql, args){
		if (this.conn === null) { throw new E.DbError('DB:SQL:BAD_CONN'); }
		return (Q.ninvoke(this.conn, 'query', sql, args))
		.then(rows_n_cols => rows_n_cols[0]);
	}

	// Grabs an entire record by id
	GetOne(table, id){
		return Q.resolve()
		.then(()=> {

			const sql= `SELECT * FROM ${table} WHERE id= ? AND di= 0`;
			return this.SqlQuery(sql, [id]);
	})
		.then(db_rows=> db_rows[0]);
	}

	// Inserts one record in to the database
	// Returns the full record that was inserted
	InsertOne(table, new_values){
		return Q.resolve()
		.then(()=> {

			const cols= ['cr']; const qs= ['?']; const arg= [null];
			for (let nm in new_values) { const val = new_values[nm]; cols.push(nm); qs.push('?'); arg.push(val); }
			const sql= `INSERT INTO ${table} (${cols.join(',')}`+
				 ') VALUES ('+ (qs.join(','))+ ')';
			return this.SqlQuery(sql, arg);
	}).then(db_result=> {

			return this.GetOne(table, db_result.insertId);
		}).then(rec=> rec);
	}

	GetByKey(ctx, table, key, vals){
		if (!vals) { throw new Error('EMPTY_VALS'); }
		const vals_type= typeof vals;

		return Q.resolve()
		.then(() => {

			const args= ['number','string'].includes(vals_type) ? [[vals]] : [vals];
			const sql= `SELECT * FROM ${table}`+
				' WHERE di= 0 AND '+ key+ ' IN (?)';
			return this.SqlQuery(sql, args);
	}).then(db_rows=> db_rows);
	}
}

exports.db= new Db(config.db.mysql);


// data=
//   Items: [
//     { name: 'apple'  }
//     { name: 'tomato' }
//   ],
//   Categories: [
//     { name: 'fruit' }
//     { name: 'vegetable' }
//   ],
//   Categories_Items: [
//     { itemId: 'Items:0', categoryId: 'Categories:0' }
//     { itemId: 'Items:1', categoryId: 'Categories:0' }
//     { itemId: 'Items:1', categoryId: 'Categories:1' }
//   ]
//

// data= {
//   Users: [
//     { username: 'bob' }
//     { username: 'Users:0:username' }
//   ]
//

// dataSpec=
//   Users: {
//     username: 'bob',
//     specId: 'mySpecialUser'
//   },
//   Items: {
//     // this resolves to bob's id
//     // at creation time
//     userId: 'Users:mySpecialUser',
//     name: 'shovel'
//   }
//