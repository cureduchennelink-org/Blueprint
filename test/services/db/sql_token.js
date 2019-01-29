/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
Test Suite for Sql Token
*/

const chai= 		require('chai');
const moment= 	require('moment');
const Util= 		require('../../lib/Util');
const {Kit}= 		require('../../../lib/kit');
const {Logger}=	require('../../../lib/logger');
const {SqlCore}= 	require('../../../lib/db/_mysql/sql_core');
const {SqlToken}= require('../../../lib/db/_mysql/sql_token');

chai.should();
const { config }= Util;
const { rename }= Util;

const kit= new Kit;
kit.add_service('config', config);
kit.new_service('logger', Logger);

const _log= kit.services.logger.log;

/*
class SqlToken
	constructor: (@core, kit)-> (logger.log)
	Create: (ctx, new_values, reread)-> (token,ident_id,client_id,expires)
	GetNonExpiredToken: (ctx, token)->
	UpdateActiveToken: (ctx, user_id, clientId, expires, new_token, current_ident_token)=>
*/

describe('Sql Token Module', function(){
	const core= new SqlCore(config.db.mysql.pool, _log);
	let tokenDb= false;
	const the_token= rename('SECRET_TOKEN');
	const valid_token= rename('VALID_TOKEN');
	const exp_token= rename('EXP_TOKEN');
	let valid_rec= false;
	let exp_rec= false;

	before(function(){

		// Insert a valid token
		const valid_vals= {
			token: valid_token,
			ident_id: Util.test_ident_id,
			client: 'TEST_FRAMEWORK',
			exp: (moment().add(config.auth.refreshTokenExpiration, 'seconds')).toDate()
		};
		return (Util.db.InsertOne('ident_tokens', valid_vals))
		.then(function(token_rec){
			valid_rec= token_rec;

			// Insert an expired token
			const exp_vals= {
				token: exp_token,
				ident_id: Util.test_ident_id,
				client: 'TEST_FRAMEWORK',
				exp: moment('2014-10-15').toDate()
			};
			return Util.db.InsertOne('ident_tokens', exp_vals);}).then(token_rec=> exp_rec= token_rec);
	});

	after(function(){});

	it('should be instantiated',function(done){
		try {
			tokenDb= new SqlToken(core, kit);
		} catch (e) {
			_log.error(e.body.error, e.body.message); done(e);
		}
		tokenDb.should.be.instanceOf(SqlToken);
		return done();
	});
	it('should use the ident_tokens table', function(){
		tokenDb.should.have.property('table');
		return tokenDb.table.should.equal('ident_tokens');
	});
	it('should create an ident_token using token, ident_id, client and exp', function(done){ // Create (re_read)
		const ctx= {conn: null, log: _log};
		let new_values= {};
		let ident_token= false;

		return (core.Acquire())
		.then(function(c){
			let re_read;
			ctx.conn= c;

			// Using token module
			new_values= {
				token: the_token,
				ident_id: Util.test_ident_id,
				client: 'TEST_FRAMEWORK',
				exp: (moment().add('seconds', config.refreshTokenExpiration)).toDate()
			};
			return tokenDb.Create(ctx, new_values, (re_read= true));}).then(function(new_rec){
			ident_token= new_rec;
			ident_token.token.should.equal(new_values.token);
			ident_token.ident_id.should.equal(Util.test_ident_id);
			ident_token.client.should.equal(new_values.client);
			ident_token.exp.toString().should.equal(new_values.exp.toString());
			// ident_token.exp.should.deep.equal new_values.exp

			// Using Test Harness DB
			return Util.db.GetByKey(ctx, 'ident_tokens', 'token', [ new_values.token ]);})
		.then(function(db_rows){
			db_rows.length.should.equal(1);
			db_rows[0].token.should.equal(new_values.token);
			db_rows[0].ident_id.should.equal(Util.test_ident_id);
			db_rows[0].client.should.equal(new_values.client);
			db_rows[0].exp.toString().should.equal(new_values.exp.toString());
			core.release(ctx.conn);
			return done();}).fail(function(err){
			_log.error({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});
	it('should not allow identical tokens to be inserted', function(done){
		const ctx= {conn: null, log: _log};
		let new_values= {};
		const ident_token= false;

		return (core.Acquire())
		.then(function(c){
			let re_read;
			ctx.conn= c;

			// Using token module
			new_values= {
				token: the_token,
				ident_id: Util.test_ident_id,
				client: 'TEST_FRAMEWORK',
				exp: (moment().add('seconds', config.refreshTokenExpiration)).toDate()
			};
			return tokenDb.Create(ctx, new_values, (re_read= true));}).then(function(new_rec){
			_log.debug({new_rec});
			return done(new Error('Test should not have gotten here'));}).fail(function(err){
			try {
				err.code.should.equal('ER_DUP_ENTRY');
				return done();
			} catch (e) {
				return done(e);
			}
		});
	});
	it('should return a full record for a specific token if not expired', function(done){
		const ctx= {conn: null, log: _log};
		const new_values= {};
		const ident_token= false;

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using token module
			return tokenDb.GetNonExpiredToken(ctx, valid_token);}).then(function(db_rows){
			db_rows.length.should.equal(1);
			db_rows[0].should.deep.equal(valid_rec);
			(moment(db_rows[0].exp)).unix().should.be.above(moment().unix());
			return done();}).fail(function(err){ _log.error({err}); return done(err); });
	});
	it('should return nothing for a specific token if expired', function(done){
		const ctx= {conn: null, log: _log};
		const new_values= {};
		const ident_token= false;

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using token module
			return tokenDb.GetNonExpiredToken(ctx, exp_token);}).then(function(db_rows){
			db_rows.length.should.equal(0);
			return done();}).fail(function(err){ _log.error({err}); return done(err); });
	});
	it('should insert a new token and remove the old one if given on update', function(done){
		const ctx= {conn: null, log: _log};
		let nv= {};
		const ident_token= false;

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using token module
			nv= {
				ident_id: Util.test_ident_id,
				client: 'TEST_FRAMEWORK',
				token: rename('ANOTHER_TOKEN'),
				exp: (moment().add(config.auth.refreshTokenExpiration, 'seconds')).toDate()
			};
			return tokenDb.UpdateActiveToken(ctx, nv, valid_token);}).then(function(new_rec){
			new_rec.token.should.equal(nv.token);
			new_rec.ident_id.should.equal(Util.test_ident_id);
			new_rec.client.should.equal(nv.client);
			new_rec.exp.toString().should.equal(nv.exp.toString());

			// Verify insert using test harness
			return Util.db.GetByKey(ctx, 'ident_tokens', 'token', [ nv.token ]);})
		.then(function(db_rows){
			db_rows.length.should.equal(1);
			db_rows[0].token.should.equal(nv.token);
			db_rows[0].ident_id.should.equal(Util.test_ident_id);
			db_rows[0].client.should.equal(nv.client);
			db_rows[0].exp.toString().should.equal(nv.exp.toString());

			// Verify original token has been deleted
			return Util.db.GetByKey(ctx, 'ident_tokens', 'token', [ valid_token ]);})
		.then(function(db_rows){
			db_rows.length.should.equal(0);
			core.release(ctx.conn);
			return done();}).fail(function(err){
			_log.error({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});
	return it('should insert and return a new token if not given an old one', function(){
		const ctx= {conn: null, log: _log};
		let nv= {};
		const ident_token= false;

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using token module
			nv= {
				ident_id: Util.test_ident_id,
				client: 'TEST_FRAMEWORK',
				token: rename('ANOTHER_TOKEN'),
				exp: (moment().add(config.auth.refreshTokenExpiration, 'seconds')).toDate()
			};
			return tokenDb.UpdateActiveToken(ctx, nv);}).then(function(new_rec){
			new_rec.token.should.equal(nv.token);
			new_rec.ident_id.should.equal(Util.test_ident_id);
			new_rec.client.should.equal(nv.client);
			new_rec.exp.toString().should.equal(nv.exp.toString());

			// Verify insert using test harness
			return Util.db.GetByKey(ctx, 'ident_tokens', 'token', [ nv.token ]);})
		.then(function(db_rows){
			db_rows.length.should.equal(1);
			db_rows[0].token.should.equal(nv.token);
			db_rows[0].ident_id.should.equal(Util.test_ident_id);
			db_rows[0].client.should.equal(nv.client);
			return db_rows[0].exp.toString().should.equal(nv.exp.toString());}).fail(function(err){
			_log.error({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});
});


















