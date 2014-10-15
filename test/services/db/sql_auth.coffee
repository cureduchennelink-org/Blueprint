###
Test Suite for Sql Core
###

chai= 		require 'chai'
Util= 		require '../../lib/Util'
{Kit}= 		require '../../../lib/kit'
{Logger}=	require '../../../lib/logger'
{SqlCore}= 	require '../../../lib/db/_mysql/sql_core'
{SqlAuth}= 	require '../../../lib/db/_mysql/sql_auth'

chai.should()
config= Util.config

kit= new Kit
kit.add_service 'config', config
kit.new_service 'logger', Logger

_log= kit.services.logger.log
rename= (name)-> 'bp-'+ name+ ''+ new Date().getTime()

###
class SqlAuth
	constructor: (@core, kit)-> (logger.log)
	Create: (ctx, new_values, reread)->
	GetById: (ctx, id)=> @GetByKey ctx, 'id', [id]
	GetAuthCreds: (ctx, cred_name)->
	GetByCredName: (ctx, cred_name)->
	UpdateById: (ctx, id, new_values, re_read)->
###

describe 'Sql Auth Module', ()->
	core= new SqlCore config.db.mysql.pool, _log
	auth= new SqlAuth core, kit
	ident= false
	conn= false

	before ()->
		vals= eml: (rename 'test@test.com'), pwd: Util.encryptedPassword
		(Util.db.InsertOne 'ident', vals)
		.then (ident_rec)->
			ident= ident_rec

	after ()->

	it 'should insert a username and password', (done)-> # Create (re_read)
		ctx= conn: null
		new_values= {}


		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using auth module
			new_values=
				eml: rename 'test@test.com'
				pwd: Util.encryptedPassword
			auth.Create ctx, new_values, re_read= true
		.then (new_rec)->
			new_rec.eml.should.equal new_values.eml
			new_rec.pwd.should.equal new_values.pwd

			# Using Test Harness DB
			Util.db.GetOne 'ident', new_rec.id
		.then (rec)->
			rec.eml.should.equal new_values.eml
			rec.pwd.should.equal new_values.pwd
			core.release ctx.conn
			done()

		.fail (err)->
			_log.debug {err}
			core.release ctx.conn unless ctx.conn is null
			done err

	it 'should get ident record (id,eml) by id', (done)-> # GetById
		ctx= conn: null, log: _log

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using auth module
			auth.GetById ctx, ident.id
		.then (db_rows)->
			db_rows[0].should.deep.equal {id: ident.id, eml: ident.eml}
			done()

		.fail (err)->
			_log.debug {err}
			core.release ctx.conn unless ctx.conn is null
			done err

	it 'should get an ident record for a username', (done)-> #GetByCredName
		ctx= conn: null, log: _log

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using auth module
			auth.GetByCredName ctx, ident.eml
		.then (db_rows)->
			db_rows[0].should.deep.equal ident
			done()

		.fail (err)->
			_log.debug {err}
			core.release ctx.conn unless ctx.conn is null
			done err

	it 'should get an id and password for a username', (done)-> # GetAuthCreds
		ctx= conn: null, log: _log

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using auth module
			auth.GetAuthCreds ctx, ident.eml
		.then (db_rows)->
			db_rows[0].should.deep.equal {id: ident.id, pwd: ident.pwd}
			done()

		.fail (err)->
			_log.debug {err}
			core.release ctx.conn unless ctx.conn is null
			done err

	it 'should update a username and password for an id', (done)-> # UpdateById (re_read)
		ctx= conn: null
		new_values= {}


		(core.Acquire()) # (ctx, id, new_values, re_read)->
		.then (c)->
			ctx.conn= c

			# Using auth module
			new_values=
				eml: rename 'test2@test.com'
				pwd: 'password'
			auth.UpdateById ctx, ident.id, new_values, re_read= true
		.then (updated_rec)->
			_log.debug 'got updated rec:', updated_rec
			updated_rec.eml.should.equal new_values.eml
			updated_rec.pwd.should.equal new_values.pwd

			# Using Test Harness DB
			Util.db.GetOne 'ident', ident.id
		.then (rec)->
			rec.eml.should.equal new_values.eml
			rec.pwd.should.equal new_values.pwd
			core.release ctx.conn
			done()

		.fail (err)->
			_log.debug {err}
			core.release ctx.conn unless ctx.conn is null
			done err




















