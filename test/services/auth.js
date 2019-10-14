/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _= 			require('lodash');
const moment= 	require('moment');
const chai= 		require('chai');
const pChai= 		require('chai-as-promised');
const Util= 		require('../lib/Util');
const Mock= 		require('../lib/Mock');
const {Kit}= 		require('../../lib/kit');
const {TokenMgr}= require('../../lib/token_manager');
const {Auth}= 	require('../../lib/auth');
const E= 			require('../../lib/error');

// Setup Chai
chai.use(pChai);
chai.should();

const encryptedPassword= 'xfGuZKjVkoNgQyXxYT8+Hg==.f+uw2I+dqzfOE4O82Znikrbdb0lOONBxl/xcWGsQtFI=';

// Config Object
const config= {
	auth: {
		key : 'KaJ14yi78x', // Used for crypto
		pbkdf2: {
			iterations: 150000,
			salt_size:	16,
			key_length:	32
		},
		bearer: 'blueprint',
		accessTokenExpiration: 10* 60
	} // seconds
};

// Mock DB Service # TODO: Use real DAO
const mockDb= {
	mysql: {
		auth: {
			pwd_col: 'pwd',
			cred_col: 'eml',
			GetAuthCreds(ctx, username){
				return [ {id: 42, eml: 'test@email.com', pwd: encryptedPassword}];
			}
		}
	}
};

// Setup the Kit
const kit= new Kit;
kit.add_service('logger', {log: {debug: console.log}});
kit.add_service('config', config);
kit.add_service('db', mockDb);
kit.new_service('tokenMgr', TokenMgr);
kit.add_service('error', E);
kit.new_service('auth', Auth);

const _log= console.log;

let req= new Mock.RestifyRequest({url: 'localhost/api', params: {p1: 'p1', p2: 'p2'}});

// class Auth
//	constructor: (kit)-> [db.mysql,logger.log,config.auth,tokenMgr, sdb.auth.pwd_col]
//	server_use: (req,res,next)->
//	ValidateCredentials: (ctx, username, password)-> ident_id
//	ComparePassword: (password, compareHash)-> bool
//	EncryptPassword: (password)-> password

describe('Auth Service', function(){
	const {
        auth
    } = kit.services; // shortcut

	it('should Encrypt passwords using variable salt', function(){
		let salt1= false; let hash1= false;
		let salt2= false; let hash2= false;
		return (auth.EncryptPassword('password'))
		.then(function(encryption){
			[salt1, hash1]= Array.from(encryption.split('.'));

			return auth.EncryptPassword('password');}).then(function(encryption){
			[salt2, hash2]= Array.from(encryption.split('.'));
			salt1.should.not.equal(salt2);
			return hash1.should.not.equal(hash2);
		});
	});

	it('should tell if a password matches an encrytped hash', function(){
		(auth.ComparePassword('password', encryptedPassword)).should.eventually.be.true;
		(auth.ComparePassword('password1', encryptedPassword)).should.eventually.be.false;
		return (auth.ComparePassword('password', encryptedPassword+ 'BROKEN')).should.eventually.be.false;
	});

	it('should validate a username and password combination', () => (auth.ValidateCredentials({}, 'test@email.com', 'password')).should.eventually.deep.equal({id: 42, role: undefined, tenant: undefined}));

	return describe('server_use', function(){
		const future= moment().add(config.auth.accessTokenExpiration, 'seconds');
		const user_data= {iid: 42, some:'thing', other:'that'};
		const good_token= kit.services.tokenMgr.encode(user_data, future, config.auth.key);
		const expired_token= kit.services.tokenMgr.encode({iid: 42}, moment(), config.auth.key);

		it('should parse an Authorization Header', function(){
			req= new Mock.RestifyRequest({headers: {authorization: `Bearer ${good_token}`}});
			req.next_called= false;
			auth.server_use(req, {}, () => req.next_called= true);
			req.should.have.property('auth');
			req.auth.should.have.property('token');
			req.auth.should.have.property('authId');
			req.auth.should.respondTo('authorize');
			req.auth.token.should.deep.equal(user_data);
			req.auth.authId.should.equal(42);
			return req.next_called.should.be.true;
		});


		it('should parse the query param "auth_token"', function(){
			req= new Mock.RestifyRequest({params: {auth_token: `${good_token}`}});
			req.next_called= false;
			auth.server_use(req, {}, () => req.next_called= true);
			req.should.have.property('auth');
			req.auth.should.have.property('token');
			req.auth.should.have.property('authId');
			req.auth.should.respondTo('authorize');
			req.auth.token.should.deep.equal(user_data);
			req.auth.authId.should.equal(42);
			return req.next_called.should.be.true;
		});

		return describe('authorize()', function(){
			it('should be true for authorized requests', function(){
				req= new Mock.RestifyRequest({params: {auth_token: `${good_token}`}});
				auth.server_use(req, {}, function(){});
				return req.auth.authorize().should.be.true;
			});

			it('should be false for an un-authorized request', function(){
				let skip;
				req= new Mock.RestifyRequest({params: {auth_token: `${expired_token}`}});
				auth.server_use(req, {}, function(){});
				return req.auth.authorize(skip= true).should.be.false;
			});

			return it('should respond with 401 for an un-authorized request', function(){
				req= new Mock.RestifyRequest({params: {auth_token: `${expired_token}`}});
				const res= new Mock.RestifyResponse;
				auth.server_use(req, res, function(){});
				req.auth.authorize();
				res.headers.should.have.property('WWW-Authenticate');
				res.data.name.should.equal('OAuthError');
				//res.data.should.be.an.instanceof E.OAuthError
				res.data.statusCode.should.equal(401);
				return res.data.body.error.should.equal('invalid_token');
			});
		});
	});
});

