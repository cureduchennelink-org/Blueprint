#
# Lamd: "Logging, Auditing, Monitoring and Debugging" Service using MongoDB
#
# Uses: kit.services.config.lamd: connect_url: 'mongodb://localhost/lamd?w=0&journal=false'
# 	i.e. expects a running MongoDB instance, db='lamd', collection='debug', options in connect_url
#
# Notes:
#
#  Method: write
#   Caller (typically an wrapper) should protect itself from errors that may occur
#   'data' should include _id if caller wants objects serialized to timestamps based on when endpoint was first called vs. when eventually written
#   w=0&journal=false behaviour currently is expected to be in the MongoClient.connect connect_url
#   Calls db.connection mutiple times w/o checking promise result - if this fails, consider a 'promise stack'
#
#  Method: server_init
#
#  Future:
#   Can hook into server middleware to log inbound requests even when they match nothing (like hacks or broken clients)
#   Add server up/down events into MongoDB stream (will need to add 'down' logic to blueprint, that gives services time to end things?)

{MongoClient}= require 'mongodb'
_= require 'lodash'

class Lamd
	@deps= services:[ 'logger'], config: 'lamd'
	constructor: (kit)->
		f= 'Lamd:constructor'
		@config= kit.services.config.lamd
		@log= kit.services.logger.log
		@db= false

	# optional server_init func (can be a promise)
	# Runs after all services are constructed, before routes added, also before server starts listening
	server_init_promise: (kit, promise_chain)=> # Return the promise_chain
		f= 'Lamd:server_init:'
		server= kit.services.server.server

		# Load and attach mongo-client to server with one connection for writing requests
		promise_chain= promise_chain.then => MongoClient.connect @config.connect_url #, @config.options ? {}
		promise_chain= promise_chain.then (db)=>
			@log.debug f, _.pick db, ['databaseName','options']
			throw new Error f+ 'MongoDB connection is empty' if not db? # Why does MongoDB need this check?
			@db= db
			@collection_debug= db.collection 'debug'

		promise_chain

	write: (data)=> # Called typically from inside a 'wrapper', so errors could either cause havac or be silently discarded
		f= 'Lamd:write:'
		try
			@_write data
		catch err
			@log.warn f+ 'err', err

	_write: (data)->
		f= 'Lamd:_write:'
		# Write record using zero wait time; Assume data does not have to be cloned
		@collection_debug.insertOne data, forceServerObjectId: true, (err, result)=>
			@log.debug f, {err,result} if err?

exports.Lamd= Lamd
