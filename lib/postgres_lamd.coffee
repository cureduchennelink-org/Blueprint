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

Promise=	require 'bluebird'
psql=		require 'pg'
_= require 'lodash'

class Postgres_Lamd
	@deps= mysql: ['lamd'], services:[ 'logger'], config: 'plamd'
	constructor: (kit)->
		f= 'PLamd:constructor'
		@config= kit.services.config.lamd
		@log= kit.services.logger.log
		@sdb= kit.services.db.mysql


	
	server_init: (kit)->
		f= 'PLamd:server_init'

		Promise.resolve().bind @
		.then ->
			# @pool= new Pool pool_opts
			# @pool.connect callback
			# Acquire DB Connection
			@sdb.core.Acquire()
		.then (c)->
			@ctx.conn= c

	
	write: (data)=> # Called typically from inside a 'wrapper', so errors could either cause havac or be silently discarded
		f= 'PLamd:write:'
		Promise.resolve().bind @
		.then ->

			@sdb.lamd.create @ctx, data


exports.Postgres_Lamd= Postgres_Lamd