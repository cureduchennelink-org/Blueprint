/**
 * Build Database Object
 * 
 * Jamie Hollowell
 */

var DbCore = require('./db_core').DbCore;

var Db = function(config, log) {
	this.core = new DbCore(config, log);
}

exports.Db = Db;

