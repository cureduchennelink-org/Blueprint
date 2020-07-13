// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Lamd: "Logging, Auditing, Monitoring and Debugging" Service using MongoDB
//
// Uses: kit.services.config.lamd: connect_url: 'mongodb://localhost/lamd?w=0&journal=false'
// 	i.e. expects a running MongoDB instance, db='lamd', collection='debug', options in connect_url
//
// Notes:
//
//  Method: write
//   Caller (typically an wrapper) should protect itself from errors that may occur
//   'data' should include _id if caller wants objects serialized to timestamps based on when endpoint was first called vs. when eventually written
//   w=0&journal=false behaviour currently is expected to be in the MongoClient.connect connect_url
//   Calls db.connection mutiple times w/o checking promise result - if this fails, consider a 'promise stack'
//
//  Method: server_init
//
//  Future:
//   Can hook into server middleware to log inbound requests even when they match nothing (like hacks or broken clients)
//   Add server up/down events into MongoDB stream (will need to add 'down' logic to blueprint, that gives services time to end things?)

const Promise=	require('bluebird');
const psql=		require('pg');
const _= require('lodash');

class Postgres_Lamd {
	static deps() {
		return {mysql: ['lamd'], services:[ 'logger'], config: 'plamd'};
	}
	constructor(kit){
		this.write = this.write.bind(this);
		const f= 'PLamd:constructor';
		this.config= kit.services.config.lamd;
		this.log= kit.services.logger.log;
		this.sdb= kit.services.db.psql;
	}


	
	server_init(kit){
		const f= 'PLamd:server_init';

		return Promise.resolve().bind(this)
		.then(function() {
			// @pool= new Pool pool_opts
			// @pool.connect callback
			// Acquire DB Connection
			return this.sdb.core.Acquire();}).then(function(c){
			return this.ctx.conn= c;
		});
	}

	
	write(data){ // Called typically from inside a 'wrapper', so errors could either cause havac or be silently discarded
		const f= 'PLamd:write:';
		return Promise.resolve().bind(this)
		.then(function() {

			return this.sdb.lamd.create(this.ctx, data);
		});
	}
}


exports.Postgres_Lamd= Postgres_Lamd;
