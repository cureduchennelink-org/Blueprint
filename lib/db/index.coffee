#
#	Database Object
#
#	Include Resource Specific DB functions here
#
#	kit dependencies:
#		logger.log.[debug,info]
#		config.db.[mysql,mongo]
#		tokenMgr
#

class Db
	constructor: (kit) ->
		log= kit.logger.log
		config= kit.config
		tokenMgr= kit.tokenMgr

		# MySql
		if config.db.mysql.enable
			log.info 'Initializing MySql...'
			{MySql}= require './_mysql'
			@mysql= new MySql config.db.mysql, tokenMgr, log

		# MongoDB
		if config.db.mongo.enable
			log.info 'Initializing MongoDB...'
			{Mongo}= require './_mongo'
			mongoose= require 'mongoose'
			mongoose.connect config.db.mongo.options
			@mongo= new Mongo config.db.mongo, log

exports.Db = Db