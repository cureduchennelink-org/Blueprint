#
#	Database Object
#
#	Include Database Interfaces Here
#

path= require 'path'

class Db
	@deps= services: ['logger','config']
	constructor: (kit) ->
		log= kit.services.logger.log
		config= kit.services.config
		@config_mongo= false

		# MySql
		if config.db.mysql.enable
			log.info 'Initializing MySql...'
			{SqlCore}= 	require './_mysql/sql_core'

			# Set up all enabled mysql modules
			@mysql= core: new SqlCore config.db.mysql.pool, log
			for nm in config.db.mysql.mods_enabled
				mod= config.db.mysql.modules[ nm]
				throw new Error 'UNKNOW MYSQL MODULE:'+nm unless mod
				mod.name= nm
				modPath= path.join config.processDir, mod.file
				log.info "Loading MySql module #{nm}@#{modPath}::#{mod.class}"
				@mysql[nm]= new (require modPath)[mod.class] @mysql.core, kit

		# MongoDB
		if config.db.mongo.enable
			log.info 'Initializing MongoDB...'
			@config_mongo= config.db.mongo
			{MongoClient}= require 'mongodb'
			# TODO REMOVE ALL MONGOOSE STUFF AT SOME POINT {MCore}= 	require './_mongo/model_core'

			# Set up all enabled Mongo Models
			@mongo= pool: {} # TODO REMOVE MONGOOSE , core: new MCore log
			for nm, model of config.db.mongo.models when model.enable
				modPath= path.join config.processDir, model.file
				@mongo[nm]= (require modPath).init mongoose, @mongo.core

	server_init_promise: (kit,promise_chain) ->
		f= 'Db:server_init'
		return promise_chain if @config_mongo is false
		# Load up various connection (pool) types based on URIs and options
		for nm, pool of @config_mongo.pool when pool.enable
			promise_chain= promise_chain.then Q MongoClient.connect pool.connect_url, pool.options
			promise_chain= promise_chain.then (db) =>
				throw new Error f+ 'MongoDB connection is empty' if not db? # Why does MongoDB need this check?
				@mongo.pool[ nm]= db
		promise_chain

exports.Db = Db
