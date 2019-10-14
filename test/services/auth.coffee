_= 			require 'lodash'
moment= 	require 'moment'
chai= 		require 'chai'
pChai= 		require 'chai-as-promised'
Util= 		require '../lib/Util'
Mock= 		require '../lib/Mock'
{Kit}= 		require '../../lib/kit'
{TokenMgr}= require '../../lib/token_manager'
{Auth}= 	require '../../lib/auth'
E= 			require '../../lib/error'

# Setup Chai
chai.use(pChai)
chai.should()

encryptedPassword= 'xfGuZKjVkoNgQyXxYT8+Hg==.f+uw2I+dqzfOE4O82Znikrbdb0lOONBxl/xcWGsQtFI='

# Config Object
config=
	auth:
		key : 'KaJ14yi78x' # Used for crypto
		pbkdf2:
			iterations: 150000
			salt_size:	16
			key_length:	32
		bearer: 'blueprint'
		accessTokenExpiration: 10* 60 # seconds

# Mock DB Service # TODO: Use real DAO
mockDb=
	mysql:
		auth:
			pwd_col: 'pwd'
			cred_col: 'eml'
			GetAuthCreds: (ctx, username)->
				[ {id: 42, eml: 'test@email.com', pwd: encryptedPassword}]

# Setup the Kit
kit= new Kit
kit.add_service 'logger', log: debug: console.log
kit.add_service 'config', config
kit.add_service 'db', mockDb
kit.new_service 'tokenMgr', TokenMgr
kit.add_service 'error', E
kit.new_service 'auth', Auth

_log= console.log

req= new Mock.RestifyRequest url: 'localhost/api', params: p1: 'p1', p2: 'p2'

# class Auth
#	constructor: (kit)-> [db.mysql,logger.log,config.auth,tokenMgr, sdb.auth.pwd_col]
#	server_use: (req,res,next)->
#	ValidateCredentials: (ctx, username, password)-> ident_id
#	ComparePassword: (password, compareHash)-> bool
#	EncryptPassword: (password)-> password

describe 'Auth Service', ()->
	auth= kit.services.auth # shortcut

	it 'should Encrypt passwords using variable salt', ()->
		salt1= false; hash1= false
		salt2= false; hash2= false
		(auth.EncryptPassword 'password')
		.then (encryption)->
			[salt1, hash1]= encryption.split '.'

			auth.EncryptPassword 'password'
		.then (encryption)->
			[salt2, hash2]= encryption.split '.'
			salt1.should.not.equal salt2
			hash1.should.not.equal hash2

	it 'should tell if a password matches an encrytped hash', ()->
		(auth.ComparePassword 'password', encryptedPassword).should.eventually.be.true
		(auth.ComparePassword 'password1', encryptedPassword).should.eventually.be.false
		(auth.ComparePassword 'password', encryptedPassword+ 'BROKEN').should.eventually.be.false

	it 'should validate a username and password combination', ()->
		(auth.ValidateCredentials {}, 'test@email.com', 'password').should.eventually.deep.equal id: 42, role: undefined, tenant: undefined

	describe 'server_use', ()->
		future= moment().add config.auth.accessTokenExpiration, 'seconds'
		user_data= {iid: 42, some:'thing', other:'that'}
		good_token= kit.services.tokenMgr.encode user_data, future, config.auth.key
		expired_token= kit.services.tokenMgr.encode {iid: 42}, moment(), config.auth.key

		it 'should parse an Authorization Header', ()->
			req= new Mock.RestifyRequest headers: authorization: "Bearer #{good_token}"
			req.next_called= false
			auth.server_use req, {}, ()-> req.next_called= true
			req.should.have.property 'auth'
			req.auth.should.have.property 'token'
			req.auth.should.have.property 'authId'
			req.auth.should.respondTo 'authorize'
			req.auth.token.should.deep.equal user_data
			req.auth.authId.should.equal 42
			req.next_called.should.be.true


		it 'should parse the query param "auth_token"', ()->
			req= new Mock.RestifyRequest params: auth_token: "#{good_token}"
			req.next_called= false
			auth.server_use req, {}, ()-> req.next_called= true
			req.should.have.property 'auth'
			req.auth.should.have.property 'token'
			req.auth.should.have.property 'authId'
			req.auth.should.respondTo 'authorize'
			req.auth.token.should.deep.equal user_data
			req.auth.authId.should.equal 42
			req.next_called.should.be.true

		describe 'authorize()', ()->
			it 'should be true for authorized requests', ()->
				req= new Mock.RestifyRequest params: auth_token: "#{good_token}"
				auth.server_use req, {}, ()->
				req.auth.authorize().should.be.true

			it 'should be false for an un-authorized request', ()->
				req= new Mock.RestifyRequest params: auth_token: "#{expired_token}"
				auth.server_use req, {}, ()->
				req.auth.authorize(skip= true).should.be.false

			it 'should respond with 401 for an un-authorized request', ()->
				req= new Mock.RestifyRequest params: auth_token: "#{expired_token}"
				res= new Mock.RestifyResponse
				auth.server_use req, res, ()->
				req.auth.authorize()
				res.headers.should.have.property 'WWW-Authenticate'
				res.data.name.should.equal 'OAuthError'
				#res.data.should.be.an.instanceof E.OAuthError
				res.data.statusCode.should.equal 401
				res.data.body.error.should.equal 'invalid_token'

