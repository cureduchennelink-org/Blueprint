_= 		require 'lodash'
moment= require 'moment'
chai= 	require 'chai'
{Kit}= 	require  '../../lib/kit'
{TokenMgr}= require '../../lib/token_manager'

chai.should()

kit= new Kit
kit.add_service 'logger', log: debug: console.log
kit.new_service 'TokenMgr', TokenMgr

_log= console.log

KEY= 'KaJ14yi78x'
urlUnSafe= /\+|\/|\=/
accessTokenExpiration= 100

# class TokenMgr
#	constructor: (kit)->
#	createToken: (length, callback)-> cb(err, String)
#	encode: (token, exp, key)-> String
#	decodeAndValidate: (rawToken, key)-> {token}

describe 'Token Manager', ()->
	tkmgr= kit.services.TokenMgr
	good_token= false
	exp= false

	it 'should create a Url Safe Base 64 Encoded String', (done)->
		tkmgr.createToken 16, (err, token)->
			_.isNull(err).should.be.true
			buffer= new Buffer token, 'base64'
			buffer.length.should.equal 16
			unsafe= urlUnSafe.test token
			unsafe.should.be.false
			done()

	it 'should encode an object and exp date in to a URL Safe access token', ()->
		exp= moment().add accessTokenExpiration, 'seconds'
		good_token= tkmgr.encode {id: 42}, exp, KEY
		parts= good_token.split '.', 2
		parts.length.should.equal 2
		unsafe= urlUnSafe.test good_token
		unsafe.should.be.false

	it 'should decode a non-expired access token', ()->
		result= tkmgr.decodeAndValidate good_token, KEY
		result.should.have.property 'token'
		result.token.should.have.property 'id'
		result.token.should.have.property 'exp'
		result.token.id.should.equal 42
		result.token.exp.should.equal exp.unix()

	it 'should return an error when decoding a bad access token', ()->
		result= false
		try
			result= tkmgr.decodeAndValidate good_token+ 'BROKEN', KEY
		catch e
			e.statusCode.should.equal 401
			e.body.error.should.equal 'invalid_token'
			e.body.message.should.equal 'Bad Signature'

		try
			parts= good_token.split '.'
			result= tkmgr.decodeAndValidate parts[0], KEY
		catch e
			e.statusCode.should.equal 401
			e.body.error.should.equal 'invalid_token'

		result.should.be.false

	it 'should return an err object when decoding an expired access token', (done)->
		expSecs= 1
		expiring_token= tkmgr.encode {id: 42}, (moment().add expSecs, 'seconds'), KEY

		# Verify valid token first
		result= tkmgr.decodeAndValidate expiring_token, KEY
		result.should.have.property 'token'
		result.token.should.have.property 'id'
		result.token.should.have.property 'exp'

		# Verify token is expired 1 second after is expired
		setTimeout ()->
			result= tkmgr.decodeAndValidate expiring_token, KEY
			result.should.have.property 'err'
			result.err.should.equal 'Token Expired'
			done()
		, expSecs* 1000+ 1000 # + 1 second







