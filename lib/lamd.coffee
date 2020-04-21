# Lamd: "Logging, Auditing, Monitoring and Debugging" Service using MongoDB
#
# Uses: kit.services.config.lamd: connect_db: 'lamd', connect_url: 'mongodb://localhost/?w=0&journal=false'
# 	i.e. expects a running MongoDB instance, db='lamd', collection='debug', options in connect_url and/or config.lamd.options
# 	@db will be the connect_db handle
# 	@collection_debug is the 'debug' colleciton in the connect_db; this is where lamd logs go
#
# Notes:
#
#  Method: write
#   Caller (typically the wrapper) is protected from errors that may occur using a catch wapper calling @_write
#   'data' should include _id if caller wants objects serialized to timestamps based on when endpoint was first called vs. when eventually written
#   w=0&journal=false behaviour currently is expected to be in the MongoClient.connect connect_url
#
#  Method: server_init
#
#  Future:
#   Can hook into server middleware to log inbound requests even when they match nothing (like hacks or broken clients)
#   Add server up/down events into MongoDB stream (will need to add 'down' logic to blueprint, that gives services time to end things?)
#   Add Runque wrapper calls to lamd logging

Promise= require 'bluebird'
_ = require 'lodash'
{MongoClient}= require 'mongodb'

class Lamd
	@deps= services:[ 'logger'], config: 'lamd{connect_url,connect_db,options}'
	constructor: (kit)->
		f= 'Lamd:constructor'
		@config= kit.services.config.lamd
		@log= kit.services.logger.log
		@db= false
		@collection_debug= false

	server_init: (kit)=>
		f= 'Lamd:server_init:'
		server= kit.services.server.server

		Promise.resolve().bind @
		.then ->
			# Load and attach mongo-client to server with one connection for writing requests
			 MongoClient.connect @config.connect_url, @config.options ? {}
		.then (client)->
			# In the new Mongo, they do not return 'db' anymore and you cannot put the db name in the URL; instead get a client and use client.db('db-name')
			# https://stackoverflow.com/a/47662979
			@log.debug 'Successfully connected to MongoDB database.' if client?
			throw new Error f + 'MongoDB connection is empty' if not client? # Why does MongoDB need this check?
			@log.debug f, _.pick client.s, ['url', 'options']


			@db= client.db @config.connect_db
			@log.debug f, _.pick @db, ['databaseName','options']
			@collection_debug= @db.collection 'debug'

	# Called typically from inside a 'wrapper', so errors are ignored using @_write
	write: (data)=>
		f= 'Lamd:write:'
		try
			@_write data
		catch err
			@log.warn f + 'err', err

	_write: (data)->
		f= 'Lamd:_write:'
		# Write record using zero wait time; Assume data does not have to be cloned
		@collection_debug.insertOne data, forceServerObjectId: true, (err, result)=>
			@log.debug f, { err, result } if err?
			@log.debug f, data if @config.to_debug

	# Called typically from Health check or Status endpoints; 'projection' is used to limit exposed information
	read: (ctx, method, query, projection, options, hint, sort)=>
		f= 'Lamd-Custom:read:'
		ctx.log.debug f, {method, query, projection, options, hint, sort}
		if method is "find"
			query= (ctx.pool.db().collection "debug").find(query).project(projection)
			query= query.sort(sort) if sort
			query= query.limit(100)
			query= query.hint(hint) if hint
			query= query.toArray()
			query.then (docs)->
				ctx.log.debug f, {docs}
				return docs
		else if method is "aggregate"
			query= (ctx.pool.db().collection "debug").aggregate(query, options)
			query= query.toArray()
			query.then (docs)->
				ctx.log.debug f, {docs}
				return docs


exports.Lamd= Lamd
