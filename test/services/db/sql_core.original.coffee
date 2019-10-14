###
Test Suite for Sql Core
###

chai= 		require 'chai'
Util= 		require '../../lib/Util'
{SqlCore}= 	require '../../../lib/db/_mysql/sql_core'

chai.should()
config= Util.config

###
class SqlCore
	constructor: (pool_opts, log)->
	StartTransaction: (ctx)=>
	method_factory: (sql_mod, name)=>
###
kit= services: error: {}, logger: log:  debug: console.log
_log= kit.services.logger.log

describe 'Sql Core', ()->
	core= new SqlCore kit, config.db.mysql.pool
	conn= false

	it 'should create a database connection pool', ()->
		core.should.have.property 'pool'
		core.pool._closed.should.be.false

	it 'should acquire a connection from the pool', (done)->
		core.acquire (err, connection)->
			done err if err
			conn= connection
			conn.should.respondTo 'query'
			core.pool._allConnections.length.should.equal 1
			conn.query 'SELECT 1 + 1 AS solution', (err, result)->
				done err if err
				result[0].solution.should.equal '2'
				done()

	it 'should release a connection from the pool', ()->
		core.release conn
		core.pool._allConnections.length.should.equal 1
		core.pool._freeConnections.length.should.equal 1

	it 'should destroy a connection from the pool', ()->
		core.acquire (err, connection)->
			done err if err
			conn= connection
			conn.should.respondTo 'query'
			core.destroy conn
			conn= false
			core.pool._freeConnections.length.should.equal 0

	it 'should perform a query against a context', ()->
		ctx= conn: null, log: _log

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			core.sqlQuery ctx, 'SELECT 1 + ? AS solution', ['1']
		.then (db_rows)->
			db_rows[0].solution.should.equal 2
			core.release ctx.conn


	it 'should start a transaction against a context', ()->
		ctx= conn: null, log: _log

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			core.StartTransaction ctx
		.then ()->

			core.StartTransaction ctx
		.then ()->
			null
		.catch (err)->
			err.should.match /ER_CANT_CHANGE_TX_CHARACTERISTICS/
			core.destroy ctx.conn


	it 'should have a common method factory', ()->
		sql_mod=
			table: 'dummy'
			schema:
				GetByKey: true, UpdateByKey: true
				DisposeByIds: true, GetCollection: true
				Create: true, UpdateById: true, DeleteById: true
				get_by_id: true # TODO: Remove when not being used
		core.method_factory sql_mod, 'MockSqlMod'
		deprecated= ['create','update_by_id','delete_by_id','get_collection']
		for nm, bool of sql_mod.schema
			sql_mod.should.respondTo nm
		for nm in deprecated
			sql_mod.should.respondTo nm






