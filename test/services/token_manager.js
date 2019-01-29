/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _= 		require('lodash');
const moment= require('moment');
const chai= 	require('chai');
const {Kit}= 	require('../../lib/kit');
const {TokenMgr}= require('../../lib/token_manager');

chai.should();

const kit= new Kit;
kit.add_service('logger', {log: {debug: console.log}});
kit.new_service('TokenMgr', TokenMgr);

const _log= console.log;

const KEY= 'KaJ14yi78x';
const urlUnSafe= /\+|\/|\=/;
const accessTokenExpiration= 100;

// class TokenMgr
//	constructor: (kit)->
//	createToken: (length, callback)-> cb(err, String)
//	encode: (token, exp, key)-> String
//	decodeAndValidate: (rawToken, key)-> {token}

describe('Token Manager', function(){
	const tkmgr= kit.services.TokenMgr;
	let good_token= false;
	let exp= false;

	it('should create a Url Safe Base 64 Encoded String', done=>
		tkmgr.createToken(16, function(err, token){
			_.isNull(err).should.be.true;
			const buffer= new Buffer(token, 'base64');
			buffer.length.should.equal(16);
			const unsafe= urlUnSafe.test(token);
			unsafe.should.be.false;
			return done();
		})
	);

	it('should encode an object and exp date in to a URL Safe access token', function(){
		exp= moment().add(accessTokenExpiration, 'seconds');
		good_token= tkmgr.encode({id: 42}, exp, KEY);
		const parts= good_token.split('.', 2);
		parts.length.should.equal(2);
		const unsafe= urlUnSafe.test(good_token);
		return unsafe.should.be.false;
	});

	it('should decode a non-expired access token', function(){
		const result= tkmgr.decodeAndValidate(good_token, KEY);
		result.should.have.property('token');
		result.token.should.have.property('id');
		result.token.should.have.property('exp');
		result.token.id.should.equal(42);
		return result.token.exp.should.equal(exp.unix());
	});

	it('should return an error when decoding a bad access token', function(){
		let result= tkmgr.decodeAndValidate(good_token+ 'BROKEN', KEY);
		result.should.have.property('error');
		result.error.should.equal('Bad Signature');

		const parts= good_token.split('.');
		result= tkmgr.decodeAndValidate(parts[0], KEY);
		result.should.have.property('error');
		return result.error.should.equal('Bad Format');
	});

	return it('should return an error when decoding an expired access token', function(done){
		const expSecs= 1;
		const expiring_token= tkmgr.encode({id: 42}, (moment().add(expSecs, 'seconds')), KEY);

		// Verify valid token first
		let result= tkmgr.decodeAndValidate(expiring_token, KEY);
		result.should.have.property('token');
		result.token.should.have.property('id');
		result.token.should.have.property('exp');

		// Verify token is expired 1 second after is expired
		return setTimeout(function(){
			result= tkmgr.decodeAndValidate(expiring_token, KEY);
			result.should.have.property('error');
			result.error.should.equal('Token Expired');
			return done();
		}
		, (expSecs* 1000)+ 1000);
	});
}); // + 1 second







