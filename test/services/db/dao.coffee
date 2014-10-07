###
Test Suite for Core Database Object.

1. Creates a MySql Interface if enabled
	a. Creates Core functionality
	b. Creates a new instance each module from config file
	c. Connects to database

2. Creates a MongoDb Interface if enabled
	a. Creates Core functionality
	b. Creates a new instance each module from config file

3. Uses the default config env
###

chai= 		require 'chai'
_= 			require 'lodash'
mongoose= 	require 'mongoose'
Util= 		require '../../lib/Util'
{Kit}= 		require '../../../lib/kit'
{Db}= 		require '../../../lib/db'
{Logger}=	require '../../../lib/logger'

# Instance Map; Filepath is relative to this test file
instMap=
	core:				inst: (require '../../../lib/db/_mysql/sql_core').SqlCore
	auth:				inst: (require '../../../lib/db/_mysql/sql_auth').SqlAuth
	user:				inst: (require '../../../lib/db/_mysql/sql_user').SqlUser
	token:				inst: (require '../../../lib/db/_mysql/sql_token').SqlToken
	trip:				inst: (require '../../../lib/db/_mysql/sql_trip').SqlTrip
	pset:				inst: (require '../../../lib/db/_mysql/sql_pset').SqlPSet
	pset_item:			inst: (require '../../../lib/db/_mysql/sql_pset').SqlPSetItem
	pset_item_change:	inst: (require '../../../lib/db/_mysql/sql_pset').SqlPSetItemChange
	m_core:				inst: (require '../../../lib/db/_mongo/model_core').MCore

chai.should()

# Overide the DB file location for testing;
# File path's are relative to Blueprint root directory
config= _.merge Util.config,
	db:
		mysql:
			modules:
				auth:				file: 'lib/db/_mysql/sql_auth'
				user:				file: 'lib/db/_mysql/sql_user'
				token:				file: 'lib/db/_mysql/sql_token'
				trip:				file: 'lib/db/_mysql/sql_trip'
				pset:				file: 'lib/db/_mysql/sql_pset'
				pset_item:			file: 'lib/db/_mysql/sql_pset'
				pset_item_change:	file: 'lib/db/_mysql/sql_pset'
		mongo:
            models:
            	Workout:  file: 'lib/db/_mongo/models/workout'

# Setup the Kit / Create DAO and add to Kit
kit= new Kit
kit.add_service 'config', config
kit.new_service 'logger', Logger
kit.new_service 'db', Db

# shortcut
db= kit.services.db

###
class Db
	constructor: (kit) -> (logger.log, config)
###
describe 'DAO', ()->

	if config.db.mysql.enable
		describe 'MySql', ()->

			it 'should be called "mysql"', ()->
				db.should.have.property 'mysql'

			it 'should expose a "core" interface', ()->
				db.mysql.should.have.property 'core'
				db.mysql.core.should.be.an.instanceof instMap.core.inst

			it 'should connect to the db', (done)->
				db.mysql.core.pool.query 'SELECT 1+1 AS solution', done

			it 'should expose a new instance of each module defined in the config', ()->
				for nm, module of config.db.mysql.modules
					db.mysql.should.have.property nm
					db.mysql[nm].should.be.an.instanceof instMap[nm].inst

	# Mongo DB Tests
	if config.db.mongo.enable
		describe 'MongoDB', ()->
			it 'should connect to db', (done)->
				return done() if mongoose.connection.readyState is 1
				mongoose.connection.readyState.should.not.equal 0 # disconnected
				mongoose.connection.readyState.should.not.equal 3 # disconnecting
				test= ()->
					setTimeout ()->
						mongoose.connection.readyState.should.equal 1 # connected
						done()
					, 1000
				test() if mongoose.connection.readyState is 2 # connecting

			it 'should be called "mongo"', ()->
				db.should.have.property 'mongo'

			it 'should expose a "core" interface', ()->
				db.mongo.should.have.property 'core'
				db.mongo.core.should.be.an.instanceof instMap.m_core.inst

			it 'should expose a new instance of each module defined in the config', ()->
				for nm, module of config.db.mongo.modules
					db.mongo.should.have.property nm
					db.mongo[nm].should.be.an.instanceof mongoose.Model





