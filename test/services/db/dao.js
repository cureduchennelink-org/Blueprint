/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
Test Suite for Core Database Object.

1. Creates a MySql Interface if enabled
	a. Creates Core functionality
	b. Creates a new instance each module from config file
	c. Connects to database

2. Creates a MongoDb Interface if enabled
	a. Creates Core functionality
	b. Creates a new instance each module from config file

3. Uses the default config env
*/

const chai= 		require('chai');
const _= 			require('lodash');
const fs= 		require('fs');
const mongoose= 	require('mongoose');
const Util= 		require('../../lib/Util');
const {Kit}= 		require('../../../lib/kit');
const {Db}= 		require('../../../lib/db');
const {Logger}=	require('../../../lib/logger');

// Instance Map; Filepath is relative to this test file
const instMap= {
	core: {				inst: (require('../../../lib/db/_mysql/sql_core')).SqlCore
},
	auth: {				inst: (require('../../../lib/db/_mysql/sql_auth')).SqlAuth
},
	user: {				inst: (require('../../../lib/db/_mysql/sql_user')).SqlUser
},
	token: {				inst: (require('../../../lib/db/_mysql/sql_token')).SqlToken
},
	trip: {				inst: (require('../../../lib/db/_mysql/sql_trip')).SqlTrip
},
	pset: {				inst: (require('../../../lib/db/_mysql/sql_pset')).SqlPSet
},
	pset_item: {			inst: (require('../../../lib/db/_mysql/sql_pset')).SqlPSetItem
},
	pset_item_change: {	inst: (require('../../../lib/db/_mysql/sql_pset')).SqlPSetItemChange
},
	m_core: {				inst: (require('../../../lib/db/_mongo/model_core')).MCore
}
};

chai.should();

// Overide the DB file location for testing;
// File path's are relative to Blueprint root directory
let bpDir= '';
if (fs.existsSync('node_modules/blueprint/lib/db/index.js')) {
	bpDir= 'node_modules/blueprint/';
}

const config= _.merge(Util.config, {
	db: {
		mysql: {
			modules: {
				auth: {				file: bpDir+ 'lib/db/_mysql/sql_auth'
			},
				user: {				file: bpDir+ 'lib/db/_mysql/sql_user'
			},
				token: {				file: bpDir+ 'lib/db/_mysql/sql_token'
			},
				trip: {				file: bpDir+ 'lib/db/_mysql/sql_trip'
			},
				pset: {				file: bpDir+ 'lib/db/_mysql/sql_pset'
			},
				pset_item: {			file: bpDir+ 'lib/db/_mysql/sql_pset'
			},
				pset_item_change: {	file: bpDir+ 'lib/db/_mysql/sql_pset'
			}
			}
		},
		mongo: {
            models: {
            	Workout:  {file: bpDir+ 'lib/db/_mongo/models/workout'}
           }
           }
	}
}
);

// Setup the Kit / Create DAO and add to Kit
const kit= new Kit;
kit.add_service('config', config);
kit.new_service('logger', Logger);
kit.new_service('db', Db);

// shortcut
const { db }= kit.services;

/*
class Db
	constructor: (kit) -> (logger.log, config)
*/
describe('DAO', function(){

	// MySql Tests
	if (config.db.mysql.enable) {
		describe('MySql', function(){

			it('should be called "mysql"', ()=> db.should.have.property('mysql'));

			it('should expose a "core" interface', function(){
				db.mysql.should.have.property('core');
				return db.mysql.core.should.be.an.instanceof(instMap.core.inst);
			});

			it('should connect to the db', done=> db.mysql.core.pool.query('SELECT 1+1 AS solution', done));

			return it('should expose a new instance of each module defined in the config', ()=>
				(() => {
					const result = [];
					for (let nm in config.db.mysql.modules) {
						const module = config.db.mysql.modules[nm];
						db.mysql.should.have.property(nm);
						result.push(db.mysql[nm].should.be.an.instanceof(instMap[nm].inst));
					}
					return result;
				})()
			);
		});
	}

	// Mongo DB Tests
	if (config.db.mongo.enable) {
		return describe('MongoDB', function(){
			it('should connect to db', function(done){
				if (mongoose.connection.readyState === 1) { return done(); }
				mongoose.connection.readyState.should.not.equal(0); // disconnected
				mongoose.connection.readyState.should.not.equal(3); // disconnecting
				const test= ()=>
					setTimeout(function(){
						mongoose.connection.readyState.should.equal(1); // connected
						return done();
					}
					, 1000)
				;
				if (mongoose.connection.readyState === 2) { return test(); }
			}); // connecting

			it('should be called "mongo"', ()=> db.should.have.property('mongo'));

			it('should expose a "core" interface', function(){
				db.mongo.should.have.property('core');
				return db.mongo.core.should.be.an.instanceof(instMap.m_core.inst);
			});

			return it('should expose a new instance of each module defined in the config', ()=>
				(() => {
					const result = [];
					for (let nm in config.db.mongo.modules) {
						const module = config.db.mongo.modules[nm];
						db.mongo.should.have.property(nm);
						result.push(db.mongo[nm].should.be.an.instanceof(mongoose.Model));
					}
					return result;
				})()
			);
		});
	}
});





