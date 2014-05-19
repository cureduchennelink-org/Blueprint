#
#	Database Object
#
#	Include Database Interfaces Here
#

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
			for mod in config.db.mysql.modules when mod.enable
				@mysql[mod.name]= 	new (require './_mysql/' + mod.file)[mod.class] @mysql.core, log

		# MongoDB
		if config.db.mongo.enable
			log.info 'Initializing MongoDB...'
			{MCore}= 	require './_mongo/model_core'
			mongoose= 	require 'mongoose'
			mongoose.connect config.db.mongo.options
			
			# Set up all enabled Mongo Models
			@mongo= mcore: new MCore log
			for model in config.db.mongo.models when model.enable
				@mongo[model.name]= require './_mongo/models/' + model.file

exports.Db = Db