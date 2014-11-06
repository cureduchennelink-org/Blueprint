#
#	Database Object
#
#	Include Database Interfaces Here
#

path= require 'path'

class Db
	constructor: (kit) ->
		log= kit.services.logger.log
		config= kit.services.config

		# MySql
		if config.db.mysql.enable
			log.info 'Initializing MySql...'
			{SqlCore}= 	require './_mysql/sql_core'

			# Set up all enabled mysql modules
			@mysql= core: new SqlCore config.db.mysql.pool, log
			for nm,mod of config.db.mysql.modules when mod.enable
				modPath= path.join config.processDir, mod.file
				@mysql[nm]= new (require modPath)[mod.class] @mysql.core, kit

		# MongoDB
		if config.db.mongo.enable
			log.info 'Initializing MongoDB...'
			{MCore}= 	require './_mongo/model_core'
			mongoose= 	require 'mongoose'
			mongoose.connect config.db.mongo.options

			# Set up all enabled Mongo Models
			@mongo= core: new MCore log
			for nm, model of config.db.mongo.models when model.enable
				modPath= path.join config.processDir, model.file
				@mongo[nm]= (require modPath).init mongoose

exports.Db = Db