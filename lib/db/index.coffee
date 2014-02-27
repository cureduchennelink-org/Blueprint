#
#	Database Object
#
#	Include Resource Specific DB functions here

class Db
	constructor: (config, tokenMgr, log) ->

		# MySql
		if config.mysql.enable
			log.info 'Initializing MySql...'
			{MySql}= require './_mysql'
			@mysql= new MySql config.mysql, tokenMgr, log

		# MongoDB
		if config.mongo.enable
			log.info 'Initializing MongoDB...'
			{Mongo}= require './_mongo'
			mongoose= require 'mongoose'
			mongoose.connect config.mongo.options
			@mongo= new Mongo config.mongo, log

exports.Db = Db

