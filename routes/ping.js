/**
 * Route: /ping/:name
 *
 * Route module for ping
 *
 */

'use strict'
var _log = console.log;
var Workout= require('../lib/db/_mongo/models/workout')

function ping( req, res, next){
	var f = 'ping';
	req.log.info(f, req.params);

	Workout.find({}, function(err, docs){
        if(!err) {
            //res.send(200, 'hello '+req.params.name);
            res.send(200, {workouts: docs});
            return next();
        } else {
            res.send(500, {message: err});
            return next();
        }
	});
}
module.exports = ping;
