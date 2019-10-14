#
#	Database Object
#
#	Include Database Interfaces Here
#

path= require 'path'
MongoClient= false # Loaded if enabled, in closure for server_init

class Db
	@deps= services: ['logger','config']
	constructor: (kit) ->
		log= kit.services.logger.log
		config= kit.services.config
		core = 	require if config.db.type is 'psql' then './_postgresql/psql_core' else './_mysql/sql_core'
		@config_mongo= false

		# MySql
		if config.db.mysql.enable
			log.info 'Initializing MySql...'
			SqlCore = core.SqlCore

			# Set up all enabled mysql modules
			@mysql= core: new SqlCore kit, config.db.mysql.pool
			for nm in config.db.mysql.mods_enabled
				mod= config.db.mysql.modules[ nm]
				throw new Error 'UNKNOW MYSQL MODULE:'+nm unless mod
				mod.name= nm
				modPath= path.join config.processDir, mod.file
				log.info "Loading MySql module #{nm}@#{modPath}::#{mod.class}"
				@mysql[nm]= new (require modPath)[mod.class] @mysql.core, kit

		# PostgreSql
		if config.db.psql.enable
			log.info 'Initializing PostgreSql...'
			SqlCore = core.PostgreSqlCore

			# Set up all enabled mysql modules
			@psql= core: new SqlCore kit, config.db.psql.pool
			for nm in config.db.psql.mods_enabled
				mod= config.db.psql.modules[ nm]
				throw new Error 'UNKNOW POSTGRESQL MODULE:'+nm unless mod
				mod.name= nm
				modPath= path.join config.processDir, mod.file
				log.info "Loading PostgreSql module #{nm}@#{modPath}::#{mod.class}"
				@psql[nm]= new (require modPath)[mod.class] @psql.core, kit

		# MongoDB
		if config.db.mongo.enable
			@config_mongo= config.db.mongo
			log.info 'Initializing MongoDB...', {@config_mongo}
			{MongoClient}= require 'mongodb'

			# Set up all enabled Mongo Models
			@mongo= pool: {}
			for nm, model of config.db.mongo.models when model.enable
				modPath= path.join config.processDir, model.file
				@mongo[nm]= (require modPath).init mongoose, @mongo.pool

	server_init_promise: (kit,promise_chain) ->
		f= 'Db:server_init'
		return promise_chain if @config_mongo is false
		# Load up various connection (pool) types based on URIs and options
		for nm, pool of @config_mongo.pool when pool.enable
			promise_chain= promise_chain.then => MongoClient.connect pool.connect_url, pool.options
			promise_chain= promise_chain.then (db) =>
				throw new Error f+ 'MongoDB connection is empty' if not db? # Why does MongoDB need this check?
				@mongo.pool[ nm]= db
		promise_chain

exports.Db = Db
