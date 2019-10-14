/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
Test Suite for Sql Core
*/

const chai= 		require('chai');
const Util= 		require('../../lib/Util');
const {SqlCore}= 	require('../../../lib/db/_mysql/sql_core');

chai.should();
const {
    config
} = Util;

/*
class SqlCore
	constructor: (pool_opts, log)->
	StartTransaction: (ctx)=>
	method_factory: (sql_mod, name)=>
*/
const kit= {services: {error: {}, logger: {log:  {debug: console.log}}}};
const _log= kit.services.logger.log;

describe('Sql Core', function(){
	const core= new SqlCore(kit, config.db.mysql.pool);
	let conn= false;

	it('should create a database connection pool', function(){
		core.should.have.property('pool');
		return core.pool._closed.should.be.false;
	});

	it('should acquire a connection from the pool', done => core.acquire(function(err, connection){
        if (err) { done(err); }
        conn= connection;
        conn.should.respondTo('query');
        core.pool._allConnections.length.should.equal(1);
        return conn.query('SELECT 1 + 1 AS solution', function(err, result){
            if (err) { done(err); }
            result[0].solution.should.equal('2');
            return done();
        });
    }));

	it('should release a connection from the pool', function(){
		core.release(conn);
		core.pool._allConnections.length.should.equal(1);
		return core.pool._freeConnections.length.should.equal(1);
	});

	it('should destroy a connection from the pool', () => core.acquire(function(err, connection){
        if (err) { done(err); }
        conn= connection;
        conn.should.respondTo('query');
        core.destroy(conn);
        conn= false;
        return core.pool._freeConnections.length.should.equal(0);
    }));

	it('should perform a query against a context', function(){
		const ctx= {conn: null, log: _log};

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			return core.sqlQuery(ctx, 'SELECT 1 + ? AS solution', ['1']);})
		.then(function(db_rows){
			db_rows[0].solution.should.equal(2);
			return core.release(ctx.conn);
		});
	});


	it('should start a transaction against a context', function(){
		const ctx= {conn: null, log: _log};

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			return core.StartTransaction(ctx);}).then(() => core.StartTransaction(ctx)).then(() => null).catch(function(err){
			err.should.match(/ER_CANT_CHANGE_TX_CHARACTERISTICS/);
			return core.destroy(ctx.conn);
		});
	});


	return it('should have a common method factory', function(){
		let nm;
		const sql_mod= {
			table: 'dummy',
			schema: {
				GetByKey: true, UpdateByKey: true,
				DisposeByIds: true, GetCollection: true,
				Create: true, UpdateById: true, DeleteById: true,
				get_by_id: true
			} // TODO: Remove when not being used
		};
		core.method_factory(sql_mod, 'MockSqlMod');
		const deprecated= ['create','update_by_id','delete_by_id','get_collection'];
		for (nm in sql_mod.schema) {
			const bool = sql_mod.schema[nm];
			sql_mod.should.respondTo(nm);
		}
		return (() => {
			const result = [];
			for (nm of Array.from(deprecated)) {
				result.push(sql_mod.should.respondTo(nm));
			}
			return result;
		})();
	});
});






