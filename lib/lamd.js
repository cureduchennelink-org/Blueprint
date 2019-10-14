// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
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

const {MongoClient}= require('mongodb');
const _= require('lodash');

class Lamd {
	static initClass() {
		this.deps= {services:[ 'logger'], config: 'lamd'};
	}
	constructor(kit){
		this.server_init_promise = this.server_init_promise.bind(this);
		this.write = this.write.bind(this);
		const f= 'Lamd:constructor';
		this.config= kit.services.config.lamd;
		this.log= kit.services.logger.log;
		this.db= false;
	}

	// optional server_init func (can be a promise)
	// Runs after all services are constructed, before routes added, also before server starts listening
	server_init_promise(kit, promise_chain){ // Return the promise_chain
		const f= 'Lamd:server_init:';
		const {
            server
        } = kit.services.server;

		// Load and attach mongo-client to server with one connection for writing requests
		promise_chain= promise_chain.then(() => MongoClient.connect(this.config.connect_url)); //, @config.options ? {}
		promise_chain= promise_chain.then(db=> {
			this.log.debug(f, _.pick(db, ['databaseName','options']));
			if ((db == null)) { throw new Error(f+ 'MongoDB connection is empty'); } // Why does MongoDB need this check?
			this.db= db;
			return this.collection_debug= db.collection('debug');
		});

		return promise_chain;
	}

	write(data){ // Called typically from inside a 'wrapper', so errors could either cause havac or be silently discarded
		const f= 'Lamd:write:';
		try {
			return this._write(data);
		} catch (err) {
			return this.log.warn(f+ 'err', err);
		}
	}

	_write(data){
		const f= 'Lamd:_write:';
		// Write record using zero wait time; Assume data does not have to be cloned
		return this.collection_debug.insertOne(data, {forceServerObjectId: true}, (err, result)=> {
			if (err != null) { return this.log.debug(f, {err,result}); }
		});
	}
}
Lamd.initClass();

exports.Lamd= Lamd;
