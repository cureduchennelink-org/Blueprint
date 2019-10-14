// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Database Object
//
//	Include Database Interfaces Here
//

const path= require('path');
let MongoClient= false; // Loaded if enabled, in closure for server_init

class Db {
	static initClass() {
		this.deps= {services: ['logger','config']};
	}
	constructor(kit) {
		let mod, modPath, nm, SqlCore;
		const {
            log
        } = kit.services.logger;
		const {
            config
        } = kit.services;
		const core = 	require(config.db.type === 'psql' ? './_postgresql/psql_core' : './_mysql/sql_core');
		this.config_mongo= false;

		// MySql
		if (config.db.mysql.enable) {
			log.info('Initializing MySql...');
			({
                SqlCore
            } = core);

			// Set up all enabled mysql modules
			this.mysql= {core: new SqlCore(kit, config.db.mysql.pool)};
			for (nm of Array.from(config.db.mysql.mods_enabled)) {
				mod= config.db.mysql.modules[ nm];
				if (!mod) { throw new Error('UNKNOW MYSQL MODULE:'+nm); }
				mod.name= nm;
				modPath= path.join(config.processDir, mod.file);
				log.info(`Loading MySql module ${nm}@${modPath}::${mod.class}`);
				this.mysql[nm]= new ((require(modPath))[mod.class])(this.mysql.core, kit);
			}
		}

		// PostgreSql
		if (config.db.psql.enable) {
			log.info('Initializing PostgreSql...');
			SqlCore = core.PostgreSqlCore;

			// Set up all enabled mysql modules
			this.psql= {core: new SqlCore(kit, config.db.psql.pool)};
			for (nm of Array.from(config.db.psql.mods_enabled)) {
				mod= config.db.psql.modules[ nm];
				if (!mod) { throw new Error('UNKNOW POSTGRESQL MODULE:'+nm); }
				mod.name= nm;
				modPath= path.join(config.processDir, mod.file);
				log.info(`Loading PostgreSql module ${nm}@${modPath}::${mod.class}`);
				this.psql[nm]= new ((require(modPath))[mod.class])(this.psql.core, kit);
			}
		}

		// MongoDB
		if (config.db.mongo.enable) {
			this.config_mongo= config.db.mongo;
			log.info('Initializing MongoDB...', {config_mongo: this.config_mongo});
			({MongoClient}= require('mongodb'));

			// Set up all enabled Mongo Models
			this.mongo= {pool: {}};
			for (nm in config.db.mongo.models) {
				const model = config.db.mongo.models[nm];
				if (model.enable) {
					modPath= path.join(config.processDir, model.file);
					this.mongo[nm]= (require(modPath)).init(mongoose, this.mongo.pool);
				}
			}
		}
	}

	server_init_promise(kit,promise_chain) {
		const f= 'Db:server_init';
		if (this.config_mongo === false) { return promise_chain; }
		// Load up various connection (pool) types based on URIs and options
		for (var nm in this.config_mongo.pool) {
			var pool = this.config_mongo.pool[nm];
			if (pool.enable) {
				promise_chain= promise_chain.then(() => MongoClient.connect(pool.connect_url, pool.options));
				promise_chain= promise_chain.then(db => {
					if ((db == null)) { throw new Error(f+ 'MongoDB connection is empty'); } // Why does MongoDB need this check?
					return this.mongo.pool[ nm]= db;
				});
			}
		}
		return promise_chain;
	}
}
Db.initClass();

exports.Db = Db;
