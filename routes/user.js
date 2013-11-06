/**
 * User routes
 * 
 * Author: Jamie Hollowell
 * 
 * @param db
 * @param log
 * @constructor
 */

function User(db, log){
	this._db = db;
	this._log = log;
	var self = this;
	
	this.get = self._db.core.pooled(function (conn, req, res, next){
		var debug = 'User.get:';
		self._log(debug, req.params.usid);
		var usid = req.params.usid;
		
		var cols = 'first_name, last_name, email, password';
		var sql = 'SELECT '+cols+' FROM t1_users WHERE id = ?';
		var args = [usid]
		conn.query(sql, args, function(err, db_rows) {
			if (err) { res.send(500, err); return next(); }
			self._log(debug, db_rows);
			if (db_rows.length != 1){
				res.send(404, {'error':'NotFound', 'message':'Unknown User'});
				return next();
			}
			res.send(200, db_rows);
			return next();
		});
		
	});
	
	this.createUser = self._db.core.pooled(function(conn, req, res, next){
		var debug = 'User.createUser:';
		var p = req.params
		self._log(debug, p);
		
		if(!p.email || !p.password){
			res.send(400, {"error":"Missing e-mail or password"});
		}
		
		var sql = 'INSERT INTO t1_users (email, password) VALUES (?,?)'
		conn.query(sql, [p.email, p.password], function(err, result){
			if (err) { res.send(500, err); return next(); }
			self._log(debug, 'got INSERT:',result);
			res.send(200, {'result': {'SUCCESS': 'true'} });
			return next();
		});
	});
}
module.exports = User;