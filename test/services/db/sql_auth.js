/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
Test Suite for Sql Auth
*/

const chai= 		require('chai');
const Util= 		require('../../lib/Util');
const {Kit}= 		require('../../../lib/kit');
const {Logger}=	require('../../../lib/logger');
const {SqlCore}= 	require('../../../lib/db/_mysql/sql_core');
const {SqlAuth}= 	require('../../../lib/db/_mysql/sql_auth');

chai.should();
const { config }= Util;

const kit= new Kit;
kit.add_service('config', config);
kit.new_service('logger', Logger);

const _log= kit.services.logger.log;
const rename= name=> `bp-${name}${new Date().getTime()}`;

/*
class SqlAuth
	constructor: (@core, kit)-> (logger.log)
	Create: (ctx, new_values, reread)->
	GetById: (ctx, id)=> @GetByKey ctx, 'id', [id]
	GetAuthCreds: (ctx, cred_name)->
	GetByCredName: (ctx, cred_name)->
	UpdateById: (ctx, id, new_values, re_read)->
*/

describe('Sql Auth Module', function(){
	const core= new SqlCore(config.db.mysql.pool, _log);
	const auth= new SqlAuth(core, kit);
	let ident= false;
	const conn= false;

	before(function(){
		const vals= {eml: (rename('test@test.com')), pwd: Util.encryptedPassword};
		return (Util.db.InsertOne('ident', vals))
		.then(ident_rec=> ident= ident_rec);
	});

	after(function(){});

	it('should insert a username and password', function(done){ // Create (re_read)
		const ctx= {conn: null};
		let new_values= {};


		return (core.Acquire())
		.then(function(c){
			let re_read;
			ctx.conn= c;

			// Using auth module
			new_values= {
				eml: rename('test@test.com'),
				pwd: Util.encryptedPassword
			};
			return auth.Create(ctx, new_values, (re_read= true));}).then(function(new_rec){
			new_rec.eml.should.equal(new_values.eml);
			new_rec.pwd.should.equal(new_values.pwd);

			// Using Test Harness DB
			return Util.db.GetOne('ident', new_rec.id);}).then(function(rec){
			rec.eml.should.equal(new_values.eml);
			rec.pwd.should.equal(new_values.pwd);
			core.release(ctx.conn);
			return done();}).fail(function(err){
			_log.debug({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});

	it('should get ident record (id,eml) by id', function(done){ // GetById
		const ctx= {conn: null, log: _log};

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using auth module
			return auth.GetById(ctx, ident.id);}).then(function(db_rows){
			db_rows[0].should.deep.equal({id: ident.id, eml: ident.eml});
			return done();}).fail(function(err){
			_log.debug({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});

	it('should get an ident record for a username', function(done){ //GetByCredName
		const ctx= {conn: null, log: _log};

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using auth module
			return auth.GetByCredName(ctx, ident.eml);}).then(function(db_rows){
			db_rows[0].should.deep.equal(ident);
			return done();}).fail(function(err){
			_log.debug({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});

	it('should get an id and password for a username', function(done){ // GetAuthCreds
		const ctx= {conn: null, log: _log};

		return (core.Acquire())
		.then(function(c){
			ctx.conn= c;

			// Using auth module
			return auth.GetAuthCreds(ctx, ident.eml);}).then(function(db_rows){
			db_rows[0].should.deep.equal({id: ident.id, pwd: ident.pwd});
			return done();}).fail(function(err){
			_log.debug({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});

	return it('should update a username and password for an id', function(done){ // UpdateById (re_read)
		const ctx= {conn: null};
		let new_values= {};


		return (core.Acquire()) // (ctx, id, new_values, re_read)->
		.then(function(c){
			let re_read;
			ctx.conn= c;

			// Using auth module
			new_values= {
				eml: rename('test2@test.com'),
				pwd: 'password'
			};
			return auth.UpdateById(ctx, ident.id, new_values, (re_read= true));}).then(function(updated_rec){
			_log.debug('got updated rec:', updated_rec);
			updated_rec.eml.should.equal(new_values.eml);
			updated_rec.pwd.should.equal(new_values.pwd);

			// Using Test Harness DB
			return Util.db.GetOne('ident', ident.id);}).then(function(rec){
			rec.eml.should.equal(new_values.eml);
			rec.pwd.should.equal(new_values.pwd);
			core.release(ctx.conn);
			return done();}).fail(function(err){
			_log.debug({err});
			if (ctx.conn !== null) { core.release(ctx.conn); }
			return done(err);
		});
	});
});




















