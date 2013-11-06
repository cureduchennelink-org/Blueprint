/**
 * Core DB Functions
 * 
 * Jamie Hollowell
 */

var mysql = require('mysql')
	, Pool = require('generic-pool').Pool;

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
	
	this.release = function(conn, callback) {
		return this.pool.release(conn, callback);
	};
	
	this.destroy = function(conn) {
		this.pool.destroy(conn)
	};
	
	this.pooled = this.pool.pooled;
	
	this.beginTransaction = function(conn, options, callback) {
        if (conn.mncTx) return callback('Error: Transaction already in progress');

        if (!callback) {
            callback = options;
            options = null;
        }

        var sql = 'START TRANSACTION';
        if (options && options.serializable) {
            sql = 'SET TRANSACTION LEVEL SERIALIZABLE; BEGIN';
        }
        return conn.query(sql, function(err) {
            if (err) return callback(new ServerError(err));

            conn.mncTx = true;
            return callback();
        });
    };
    
    this.rollbackTransaction = function(conn, originalErr, callback) {
        if (!conn.mncTx) {
            log('DbCore.rollbackTransaction: Attempted rollback when no transaction in progress');
            return callback(originalErr);
        }
        conn.mncTx = false;
        return conn.query('ROLLBACK', function(err) {
            return err ? callback(err) : callback(originalErr);
        });
    };
    
    this.commitTransaction = function(conn, callback) {
        if (!conn.mncTx) return callback('There is no transaction to commit');
        return conn.query('COMMIT;', function(err) {
            if (err) return self._rollbackTransaction(conn, err, callback);

            conn.mncTx = false;
            callback(null);
        });
    };
    
    this.transacted = this.pooled(function(conn, fn, options, callback) {
        if (!callback) {
            callback = options;
            options = {};
        }

        self.beginTransaction(conn, options, function(err) {
            if (err) return callback(err);

            return fn(conn, function(err, rval) {
                if (err) return self.rollbackTransaction(conn, err, callback);

                return self.commitTransaction(conn, function(err) {
                    if (err) return callback(err);

                    return callback(null, rval);
                });
            });
        });
    });
    
    
};
exports.DbCore = DbCore;