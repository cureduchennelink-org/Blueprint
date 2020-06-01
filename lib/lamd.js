// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Lamd: "Logging, Auditing, Monitoring and Debugging" Service using MongoDB
//
// Uses: kit.services.config.lamd: connect_db: 'lamd', connect_url: 'mongodb://localhost/?w=0&journal=false'
// 	i.e. expects a running MongoDB instance, db='lamd', collection='debug', options in connect_url and/or config.lamd.options
// 	@db will be the connect_db handle
// 	@collection_debug is the 'debug' colleciton in the connect_db; this is where lamd logs go
//
// Notes:
//
//  Method: write
//   Caller (typically the wrapper) is protected from errors that may occur using a catch wapper calling @_write
//   'data' should include _id if caller wants objects serialized to timestamps based on when endpoint was first called vs. when eventually written
//   w=0&journal=false behaviour currently is expected to be in the MongoClient.connect connect_url
//
//  Method: server_init
//
//  Future:
//   Can hook into server middleware to log inbound requests even when they match nothing (like hacks or broken clients)
//   Add server up/down events into MongoDB stream (will need to add 'down' logic to blueprint, that gives services time to end things?)
//   Add Runque wrapper calls to lamd logging
//   TODO Avoid console.log so disks dont' fill up; maybe only if to_debug

const Promise= require('bluebird');
const _ = require('lodash');
const {MongoClient}= require('mongodb');

class Lamd {
	static initClass() {
		this.deps= {services:[ 'logger'], config: 'lamd{connect_url,connect_db,options}'};
	}
	constructor(kit){
		this.server_init = this.server_init.bind(this);
		this.write = this.write.bind(this);
		this.write_deep = this.write_deep.bind(this);
		this.read = this.read.bind(this);
		this.read_deep = this.read_deep.bind(this);
		this._read = this._read.bind(this);
		const f= 'Lamd:constructor';
		this.config= kit.services.config.lamd;
		this.log= kit.services.logger.log;
		this.db= false;
		this.collection_debug= false;
		this.collection_deep_debug= false;
	}

	GetLog(ctx){
		ctx.lamd_logger= {debug: []};
		const lamd_logger= {};
		for (let method of [ 'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'child', ]) {
			(method=> {
				return lamd_logger[ method]= (f, data)=> this._log(ctx, method, f, data);
			})(method);
		}
		return lamd_logger;
	}

	_log(ctx, method, f, data){
		if (this.config.to_debug) { this.log.debug(f+( method !== 'debug' ? method : ''), data); }
		if (method === 'child') { return; }
		return ctx.lamd_logger.debug.push({method, f, data});
	}

	server_init(kit){
		const f= 'Lamd:server_init:';
		const {
            server
        } = kit.services.server;

		return Promise.resolve().bind(this)
		.then(function() {
			// Load and attach mongo-client to server with one connection for writing requests
			 return MongoClient.connect(this.config.connect_url, this.config.options != null ? this.config.options : {});})
		.then(function(client){
			// In the new Mongo, they do not return 'db' anymore and you cannot put the db name in the URL; instead get a client and use client.db('db-name')
			// https://stackoverflow.com/a/47662979
			if (client != null) { this.log.debug('Successfully connected to MongoDB database.'); }
			if ((client == null)) { throw new Error(f + 'MongoDB connection is empty'); } // Why does MongoDB need this check?
			this.log.debug(f, _.pick(client.s, ['url', 'options']));


			this.db= client.db(this.config.connect_db);
			this.log.debug(f, _.pick(this.db, ['databaseName','options']));
			this.collection_debug= this.db.collection('debug');
			return this.collection_deep_debug= this.db.collection('deep_debug');
		});
	}

	// Called typically from inside a 'wrapper', so errors are ignored using @_write
	write(data){
		const f= 'Lamd:write:';
		try {
			return this._write(data);
		} catch (err) {
			return this.log.warn(f + 'err', err);
		}
	}

	_write(data){
		const f= 'Lamd:_write:';
		// Write record using zero wait time; Assume data does not have to be cloned
		return this.collection_debug.insertOne(data, {forceServerObjectId: true}, (err, result)=> {
			if (err != null) { return this.log.debug(f, { err, result }); }
			if (this.config.to_debug) { return this.log.debug(f, data); }
		});
	}

	// Called typically from inside a 'wrapper', so errors are ignored using @_write_deep
	write_deep(ctx){
		const f = 'Lamd:write:';
		try {
			return this._write_deep(ctx);
		} catch (err) {
			return this.log.warn(f + 'err', err);
		}
	}

	_write_deep(ctx){ // The 'ctx' has accumulated the 'debug' lines
		const f = 'Lamd:_write_deep:';
		const data= ctx.lamd_logger.debug;
		// Write record using zero wait time; Assume data does not have to be cloned
		return this.collection_deep_debug.insertOne({_id: ctx.lamd.req_uuid, lamd: ctx.lamd, debug: data}, {}, (err, result)=> {
			if (err != null) { return this.log.debug(f, { err, result }); }
		});
	}

	// Called typically from Health check or Status endpoints; 'projection' is used to limit exposed information
	read(ctx, method, query, projection, options, hint, sort){
		return this._read(ctx, this.collection_debug, method, query, projection, options, hint, sort);
	}

	read_deep(ctx, method, query, projection, options, hint, sort){
		return this._read(ctx, this.collection_deep_debug, method, query, projection, options, hint, sort);
	}

	_read(ctx, collection, method, query, projection, options, hint, sort){
		const f= 'Lamd-Custom:read:';
		if (method === "find") {
			query = collection.find(query).project(projection);
			if (sort) { query = query.sort(sort); }
			query = query.limit(100);
			if (hint) { query = query.hint(hint); }
			query = query.toArray();
			return query.then(docs=> {
				if (this.config.to_debug) { this.log.debug(f, {docs}); }
				return docs;
			});
		} else if (method === "aggregate") {
			query = collection.aggregate(query, options);
			query = query.toArray();
			return query.then(docs=> {
				if (this.config.to_debug) { this.log.debug(f, {docs}); }
				return docs;
			});
		}
	}
}
Lamd.initClass();

exports.Lamd= Lamd;
