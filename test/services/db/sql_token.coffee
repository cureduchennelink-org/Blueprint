###
Test Suite for Sql Token
###

chai= 		require 'chai'
moment= 	require 'moment'
Util= 		require '../../lib/Util'
{Kit}= 		require '../../../lib/kit'
{Logger}=	require '../../../lib/logger'
{SqlCore}= 	require '../../../lib/db/_mysql/sql_core'
{SqlToken}= require '../../../lib/db/_mysql/sql_token'

chai.should()
config= Util.config
rename= Util.rename

kit= new Kit
kit.add_service 'config', config
kit.add_service 'error', {}
kit.new_service 'logger', Logger

_log= kit.services.logger.log

###
class SqlToken
	constructor: (@core, kit)-> (logger.log)
	Create: (ctx, new_values, reread)-> (token,ident_id,client_id,expires)
	GetNonExpiredToken: (ctx, token)->
	UpdateActiveToken: (ctx, user_id, clientId, expires, new_token, current_ident_token)=>
###

describe 'Sql Token Module', ()->
	core= new SqlCore kit, config.db.mysql.pool
	tokenDb= false
	the_token= rename 'SECRET_TOKEN'
	valid_token= rename 'VALID_TOKEN'
	exp_token= rename 'EXP_TOKEN'
	valid_rec= false
	exp_rec= false

	before ()->
		# Insert a valid token
		valid_vals=
			token: valid_token
			ident_id: Util.test_ident_id
			client: 'TEST_FRAMEWORK'
			exp: (moment().add config.auth.refreshTokenExpiration, 'seconds').toDate()
		(Util.db.InsertOne 'ident_tokens', valid_vals)
		.then (token_rec)->
			valid_rec= token_rec

			# Insert an expired token
			exp_vals=
				token: exp_token
				ident_id: Util.test_ident_id
				client: 'TEST_FRAMEWORK'
				exp: moment('2014-10-15').toDate()
			Util.db.InsertOne 'ident_tokens', exp_vals
		.then (token_rec)->
			exp_rec= token_rec

	after ()->

	it 'should be instantiated',(done)->
		tokenDb= new SqlToken core, kit
		tokenDb.should.be.instanceOf SqlToken
		done()

	it 'should use the ident_tokens table', ()->
		tokenDb.should.have.property 'table'
		tokenDb.table.should.equal 'ident_tokens'

	it 'should create an ident_token using token, ident_id, client and exp', -> # Create (re_read)
		ctx= conn: null, log: _log
		new_values= {}
		ident_token= false

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using token module
			new_values=
				token: the_token
				ident_id: Util.test_ident_id
				client: 'TEST_FRAMEWORK'
				exp: (moment().add 'seconds', config.refreshTokenExpiration).toDate()
			tokenDb.Create ctx, new_values, re_read= true
		.then (new_rec)->
			ident_token= new_rec
			ident_token.token.should.equal new_values.token
			ident_token.ident_id.should.equal Util.test_ident_id
			ident_token.client.should.equal new_values.client
			ident_token.exp.toString().should.equal new_values.exp.toString()
			# ident_token.exp.should.deep.equal new_values.exp

			# Using Test Harness DB
			Util.db.GetByKey ctx, 'ident_tokens', 'token', [ new_values.token ]
		.then (db_rows)->
			db_rows.length.should.equal 1
			db_rows[0].token.should.equal new_values.token
			db_rows[0].ident_id.should.equal Util.test_ident_id
			db_rows[0].client.should.equal new_values.client
			db_rows[0].exp.toString().should.equal new_values.exp.toString()
			core.release ctx.conn

		.catch (err)->
			_log.error {err}
			core.release ctx.conn unless ctx.conn is null
			throw err

	it 'should not allow identical tokens to be inserted', ->
		ctx= conn: null, log: _log
		new_values= {}
		ident_token= false

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using token module
			new_values=
				token: the_token
				ident_id: Util.test_ident_id
				client: 'TEST_FRAMEWORK'
				exp: (moment().add 'seconds', config.refreshTokenExpiration).toDate()
			tokenDb.Create ctx, new_values, re_read= true
		.then (new_rec)->
			_log.debug {new_rec}
			new Error 'Test should not have gotten here'

		.catch (err)->
			err.code.should.equal 'ER_DUP_ENTRY'

	it 'should return a full record for a specific token if not expired', ->
		ctx= conn: null, log: _log
		new_values= {}
		ident_token= false

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using token module
			# JCS: This function was updated to return only the matching ident record with only what is re-encoded into an access token
			tokenDb.GetNonExpiredToken ctx, valid_token
		.then (db_rows)->
			db_rows.should.deep.equal [ id: Util.test_ident_id, role: null, tenant: null]

	it 'should return nothing for a specific token if expired', ->
		ctx= conn: null, log: _log
		new_values= {}
		ident_token= false

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using token module
			tokenDb.GetNonExpiredToken ctx, exp_token
		.then (db_rows)->
			db_rows.length.should.equal 0

	it 'should insert a new token and remove the old one if given on update', ->
		ctx= conn: null, log: _log
		nv= {}
		ident_token= false

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using token module
			nv=
				ident_id: Util.test_ident_id
				client: 'TEST_FRAMEWORK'
				token: rename 'ANOTHER_TOKEN'
				exp: (moment().add config.auth.refreshTokenExpiration, 'seconds').toDate()
			tokenDb.UpdateActiveToken ctx, nv, valid_token
		.then (new_rec)->
			new_rec.token.should.equal nv.token
			new_rec.ident_id.should.equal Util.test_ident_id
			new_rec.client.should.equal nv.client
			new_rec.exp.toString().should.equal nv.exp.toString()

			# Verify insert using test harness
			Util.db.GetByKey ctx, 'ident_tokens', 'token', [ nv.token ]
		.then (db_rows)->
			db_rows.length.should.equal 1
			db_rows[0].token.should.equal nv.token
			db_rows[0].ident_id.should.equal Util.test_ident_id
			db_rows[0].client.should.equal nv.client
			db_rows[0].exp.toString().should.equal nv.exp.toString()

			# Verify original token has been deleted
			Util.db.GetByKey ctx, 'ident_tokens', 'token', [ valid_token ]
		.then (db_rows)->
			db_rows.length.should.equal 0
			core.release ctx.conn

		.catch (err)->
			_log.error {err}
			core.release ctx.conn unless ctx.conn is null

	it 'should insert and return a new token if not given an old one', ->
		ctx= conn: null, log: _log
		nv= {}
		ident_token= false

		(core.Acquire())
		.then (c)->
			ctx.conn= c

			# Using token module
			nv=
				ident_id: Util.test_ident_id
				client: 'TEST_FRAMEWORK'
				token: rename 'ANOTHER_TOKEN'
				exp: (moment().add config.auth.refreshTokenExpiration, 'seconds').toDate()
			tokenDb.UpdateActiveToken ctx, nv
		.then (new_rec)->
			new_rec.token.should.equal nv.token
			new_rec.ident_id.should.equal Util.test_ident_id
			new_rec.client.should.equal nv.client
			new_rec.exp.toString().should.equal nv.exp.toString()

			# Verify insert using test harness
			Util.db.GetByKey ctx, 'ident_tokens', 'token', [ nv.token ]
		.then (db_rows)->
			db_rows.length.should.equal 1
			db_rows[0].token.should.equal nv.token
			db_rows[0].ident_id.should.equal Util.test_ident_id
			db_rows[0].client.should.equal nv.client
			db_rows[0].exp.toString().should.equal nv.exp.toString()

		.catch (err)->
			_log.error {err}
			core.release ctx.conn unless ctx.conn is null
			throw err


















