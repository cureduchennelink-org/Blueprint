//
//	Database Object
//
//	Include Database Interfaces Here
//

const path= require('path');

class Db {
	constructor(kit) {
		let modPath, nm;
		const { log }= kit.services.logger;
		const { config }= kit.services;

		// MySql
		if (config.db.mysql.enable) {
			log.info('Initializing MySql...');
			const {SqlCore}= 	require('./_mysql/sql_core');

			// Set up all enabled mysql modules
			this.mysql= {core: new SqlCore(config.db.mysql.pool, log)};
			for (nm in config.db.mysql.modules) {
				const mod = config.db.mysql.modules[nm];
				if (mod.enable) {
					modPath= path.join(config.processDir, mod.file);
					this.mysql[nm]= new ((require(modPath))[mod.class])(this.mysql.core, kit);
				}
			}
		}

		// MongoDB
		if (config.db.mongo.enable) {
			log.info('Initializing MongoDB...');
			const {MCore}= 	require('./_mongo/model_core');
			const mongoose= 	require('mongoose');
			mongoose.connect(config.db.mongo.options);

			// Set up all enabled Mongo Models
			this.mongo= {core: new MCore(log)};
			for (nm in config.db.mongo.models) {
				const model = config.db.mongo.models[nm];
				if (model.enable) {
					modPath= path.join(config.processDir, model.file);
					this.mongo[nm]= (require(modPath)).init(mongoose, this.mongo.core);
				}
			}
		}
	}
}

exports.Db = Db;