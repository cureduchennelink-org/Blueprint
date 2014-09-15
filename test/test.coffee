chai= require 'chai'
chai.should()

{Kit}=		require  '../lib/kit'
# config= 	(require '../lib/config')()
{Logger}=	require  '../lib/logger'
{Clinic}= 	require '../routes/r_clinic'

mockDb= mysql: ()->
mockConfig=
	log:
		name: 'siproto'
		level: 'debug'

kit= new Kit
kit.add_service 'config', 		mockConfig	# Config Object
kit.new_service 'logger', 		Logger		# Bunyan Logger
kit.add_service 'db', 			mockDb		# Db
describe 'SI Prototype', ()->
	describe 'Clinic Routes', ()->
		clinic= new Clinic kit
		
		it 'should be defined properly', ()->
			for endpoint in clinic.endpoints
				endpoint.should.have.property 'verb'
				endpoint.should.have.property 'route'
				endpoint.should.have.property 'wrap'
				endpoint.should.have.property 'version'