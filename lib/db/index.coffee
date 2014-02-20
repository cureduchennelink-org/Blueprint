#
#	Database Object
#
#	Include Resource Specific DB functions here

class Db
	constructor: (config, log) ->

		# MySql
		if config.mysql.enable
			log.debug 'Initializing MySql...'
			{MySql}= require './_mysql'
			@mysql= new MySql config.mysql, log

		# MongoDB
		if config.mongo.enable
			log.debug 'Initializing MongoDB...'
			{Mongo}= require './_mongo'
			mongoose= require 'mongoose'
			mongoose.connect config.mongo.options
			@mongo= new Mongo config.mongo, log

exports.Db = Db

