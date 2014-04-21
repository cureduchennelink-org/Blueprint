// Generated by CoffeeScript 1.6.3
(function() {
  var E, Q, Workout, odb, sdb;

  Q = require('q');

  E = require('../lib/error');

  odb = false;

  sdb = false;

  Workout = (function() {
    function Workout(kit) {
      kit.logger.log.info('Initializing Workout Routes...');
      odb = kit.db.mongo;
      sdb = kit.db.mysql;
      this.caller = {
        get: {
          use: true,
          wrap: 'read_wrap',
          version: {
            any: this._get
          },
          auth_required: true
        },
        create: {
          use: true,
          wrap: 'update_wrap',
          version: {
            any: this._create
          },
          auth_required: true
        }
      };
    }

    Workout.prototype._get = function(conn, p, pre_loaded, _log) {
      var f, use_docs;
      use_docs = {};
      if (conn === 'use') {
        return use_docs;
      }
      f = 'Workout:_get:';
      _log.debug(f, p);
      return Q.resolve().then(function() {
        return odb.mcore.find(odb.Workout, {});
      }).then(function(docs) {
        return {
          send: {
            workouts: docs
          }
        };
      });
    };

    Workout.prototype._create = function(conn, p, pre_loaded, _log) {
      var f, newWorkout, opts, use_docs;
      use_docs = {
        description: 'rS',
        workout_name: 'rS',
        type: 'rE:good,bad'
      };
      if (conn === 'use') {
        return use_docs;
      }
      f = 'Workout:_create:';
      newWorkout = false;
      opts = {
        name: p.workout_name,
        description: p.description,
        type: p.type
      };
      if (!p.description) {
        throw new E.MissingArg('description');
      }
      if (!p.workout_name) {
        throw new E.MissingArg('workout_name');
      }
      if (!p.type) {
        throw new E.MissingArg('type');
      }
      return Q.resolve().then(function() {
        return odb.Workout.FindByName(p.workout_name);
      }).then(function(docs) {
        _log.debug('got docs:', docs);
        if (docs.length > 0) {
          throw new E.AccessDenied('Name already exists', {
            name: p.workout_name
          });
        }
        newWorkout = new odb.Workout(opts);
        _log.debug('typeName:', newWorkout.typeName);
        return newWorkout.FindSimilarTypes();
      }).then(function(docs) {
        _log.debug('got similar Types:', docs);
        return odb.mcore.create(odb.Workout, opts);
      }).then(function() {
        return {
          send: {
            success: true,
            message: 'Workout created with name:' + newWorkout.name
          }
        };
      });
    };

    return Workout;

  })();

  exports.Workout = Workout;

}).call(this);
