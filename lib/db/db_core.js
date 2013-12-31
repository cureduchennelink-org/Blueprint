/**
 * Core DB Functions
 * 
 * Jamie Hollowell
 */

var mysql = require('mysql')
	, Pool = require('generic-pool').Pool
	, Q= require('q');

var DbCore = function(config, log) {
	
	this.pool = Pool ({
		name: 'mysql - MNC',
		create: function(callback) {
			var conn = mysql.createConnection(config);
			callback(null, conn)
		},
		destroy: function(conn) { conn.end(); },
		max: config.maxConnections,
		min: config.minConnections,
		idleTimeoutMillis: config.idleTimeoutMillis,
		log: config.debug ? function(string, level) {if (level != 'verbose') console.log(level.toUpperCase() + ' ' + string);} : false
	});
	
	var self = this;
	
	this.acquire = function(callback) {
		return this.pool.acquire(callback);
	};
	this.Acquire = Q.nbind(this.acquire, this);
	
	this.release = function(conn) {
		return this.pool.release(conn);
	};
	
	this.destroy = function(conn) {
		this.pool.destroy(conn)
	};
	
	this.pooled = this.pool.pooled;
	
    this.sqlQuery = function(conn, sql, args) {
        log.debug('sqlQuery:', sql, args)
        return (Q.ninvoke(conn, 'query', sql, args)).then(function(rows_n_cols) {
            return rows_n_cols[0];
        });
    };
    
    
};
exports.DbCore = DbCore;