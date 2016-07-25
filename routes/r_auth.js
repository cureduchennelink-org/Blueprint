// Generated by CoffeeScript 1.8.0
(function() {
  var AuthRoute, E, Q, crypto, moment, sdb,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Q = require('q');

  E = require('../lib/error');

  crypto = require('crypto');

  moment = require('moment');

  sdb = false;

  AuthRoute = (function() {
    function AuthRoute(kit) {
      this._get_auth_trip = __bind(this._get_auth_trip, this);
      this._verify_forgot = __bind(this._verify_forgot, this);
      this._forgot_password = __bind(this._forgot_password, this);
      this._update_password = __bind(this._update_password, this);
      this._verify_email = __bind(this._verify_email, this);
      this._update_email = __bind(this._update_email, this);
      this._authenticate = __bind(this._authenticate, this);
      this.log = kit.services.logger.log;
      sdb = kit.services.db.mysql;
      this.ses = kit.services.ses;
      this.auth = kit.services.auth;
      this.config = kit.services.config;
      this.tripMgr = kit.services.tripMgr;
      this.tokenMgr = kit.services.tokenMgr;
      this.endpoints = {
        authenticate: {
          verb: 'post',
          route: '/Auth',
          use: true,
          wrap: 'auth_wrap',
          version: {
            any: this._authenticate
          }
        },
        update_password: {
          verb: 'put',
          route: '/Auth/:auid/updatepassword',
          use: true,
          wrap: 'default_wrap',
          version: {
            any: this._update_password
          },
          sql_conn: true,
          sql_tx: true,
          auth_required: true
        },
        update_email: {
          verb: 'post',
          route: '/Auth/:auid/updateemail',
          use: true,
          wrap: 'default_wrap',
          version: {
            any: this._update_email
          },
          sql_conn: true,
          sql_tx: true,
          auth_required: true
        },
        forgot_password: {
          verb: 'post',
          route: '/AuthChange',
          use: true,
          wrap: 'default_wrap',
          version: {
            any: this._forgot_password
          },
          sql_conn: true,
          sql_tx: true
        },
        read_auth_trip: {
          verb: 'get',
          route: '/AuthChange/:token',
          use: true,
          wrap: 'default_wrap',
          version: {
            any: this._get_auth_trip
          },
          sql_conn: true
        },
        verify_forgot: {
          verb: 'post',
          route: '/AuthChange/:token/verifyforgot',
          use: true,
          wrap: 'default_wrap',
          version: {
            any: this._verify_forgot
          },
          sql_conn: true,
          sql_tx: true
        },
        verify_email: {
          verb: 'post',
          route: '/AuthChange/:token/verifyemail',
          use: true,
          wrap: 'default_wrap',
          version: {
            any: this._verify_email
          },
          sql_conn: true,
          sql_tx: true
        }
      };
    }

    AuthRoute.prototype.make_tbl = function(recipient, token, options, page_name, ctx) {
      var custom;
      custom = ctx && typeof this.config.ses.customize === 'function' ? this.config.ses.customize(ctx, page_name, recipient, token, options) : [
        {
          custom: false
        }
      ];
      return {
        Trip: [
          {
            token: token
          }
        ],
        Recipient: [recipient],
        Opt: [options],
        Custom: custom
      };
    };

    AuthRoute.prototype._authenticate = function(ctx, pre_loaded) {
      var access_expires_in, current_token, f, need_refresh, new_token, p, refresh_expires_in, result, use_doc, _log;
      use_doc = {
        params: {
          client_id: 'r:S',
          username: 'r:S',
          password: 'r:S',
          grant_type: 'r:S'
        },
        response: {
          access_token: 'string',
          token_type: 'string',
          expires_in: 'number - seconds',
          refresh_token: 'string'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_authenticate:';
      p = ctx.p;
      _log = ctx.log;
      _log.debug(f, p, pre_loaded);
      current_token = false;
      new_token = false;
      need_refresh = true;
      refresh_expires_in = this.config.auth.refreshTokenExpiration;
      access_expires_in = this.config.auth.accessTokenExpiration;
      result = {};
      return Q.resolve().then((function(_this) {
        return function() {
          if (p.grant_type !== 'password') {
            return false;
          }
          return _this.auth.ValidateCredentials(ctx, p.username, p.password);
        };
      })(this)).then(function(auth_ident_id) {
        _log.debug(f, 'got auth_ident_id:', auth_ident_id);
        if (auth_ident_id !== false) {
          result.auth_ident_id = auth_ident_id;
        }
        if (p.grant_type !== 'refresh_token') {
          return false;
        }
        return sdb.token.GetNonExpiredToken(ctx, p.refresh_token);
      }).then((function(_this) {
        return function(valid_token) {
          _log.debug(f, 'got valid token:', valid_token);
          if (valid_token !== false) {
            if (valid_token.length === 0) {
              throw new E.OAuthError(401, 'invalid_grant', 'Refresh token invalid.');
            }
            result.auth_ident_id = valid_token[0].ident_id;
          }
          if (p.grant_type !== 'client_credentials') {
            return false;
          }
          if (!p.client_secret) {
            throw new E.MissingArg('client_secret');
          }
          return _this.auth.ValidateCredentials(ctx, p.client_id, p.client_secret);
        };
      })(this)).then((function(_this) {
        return function(auth_ident_id) {
          _log.debug(f, 'got confidential auth_ident_id:', auth_ident_id);
          if (auth_ident_id !== false) {
            result.auth_ident_id = auth_ident_id;
            need_refresh = false;
          }
          if (!need_refresh) {
            return false;
          }
          return _this.tokenMgr.CreateToken(16);
        };
      })(this)).then((function(_this) {
        return function(token) {
          var exp, nv;
          if (!need_refresh) {
            return false;
          }
          if (p.grant_type === 'refresh_token') {
            current_token = p.refresh_token;
          }
          exp = refresh_expires_in;
          nv = {
            ident_id: result.auth_ident_id,
            client: p.client_id,
            token: token,
            exp: exp
          };
          return sdb.token.UpdateActiveToken(ctx, nv, current_token);
        };
      })(this)).then((function(_this) {
        return function(ident_token) {
          var access_token, exp, refresh_token;
          if (ident_token !== false) {
            refresh_token = ident_token.token;
          }
          exp = moment().add(access_expires_in, 'seconds');
          access_token = _this.tokenMgr.encode({
            iid: result.auth_ident_id
          }, exp, _this.config.auth.key);
          return {
            send: {
              access_token: access_token,
              token_type: 'bearer',
              expires_in: access_expires_in,
              refresh_token: refresh_token
            }
          };
        };
      })(this));
    };

    AuthRoute.prototype._update_email = function(ctx, pre_loaded) {
      var conn, f, p, use_doc, _log;
      use_doc = {
        params: {
          eml: 'r:S'
        },
        response: {
          success: 'bool'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_update_email:';
      p = ctx.p;
      conn = ctx.conn;
      _log = ctx.log;
      if (p.auid !== 'me') {
        if ((Number(p.auid)) !== pre_loaded.auth_id) {
          throw new E.AccessDenied('AUTH:UPDATE_EMAIL:AUTH_ID');
        }
      }
      if (!p.eml) {
        throw new E.MissingArg('eml');
      }
      return Q.resolve().then((function(_this) {
        return function() {
          return sdb.auth.GetByCredName(ctx, p.eml);
        };
      })(this)).then((function(_this) {
        return function(db_rows) {
          _log.debug('got ident with eml:', db_rows);
          if (db_rows.length !== 0) {
            throw new E.AccessDenied('AUTH:UPDATE_EMAIL:EMAIL_EXISTS');
          }
          return _this.tripMgr.planTrip(ctx, pre_loaded.auth_id, {
            eml: p.eml
          }, null, 'update_email');
        };
      })(this)).then((function(_this) {
        return function(new_trip) {
          var recipient, trip;
          _log.debug(f, 'got round trip:', new_trip);
          trip = new_trip;
          recipient = {
            eml: p.eml
          };
          return _this.ses.send('verify_email_change', _this.make_tbl(recipient, trip.token, _this.config.ses.options));
        };
      })(this)).then(function() {
        var success;
        success = true;
        return {
          send: {
            success: success
          }
        };
      });
    };

    AuthRoute.prototype._verify_email = function(ctx, pre_loaded) {
      var f, ident, new_eml, p, trip, use_doc, _log;
      use_doc = {
        params: {},
        response: {
          success: 'bool'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_verify_email:';
      p = ctx.p;
      _log = ctx.log;
      trip = false;
      ident = false;
      new_eml = false;
      return Q.resolve().then((function(_this) {
        return function() {
          return _this.tripMgr.getTripFromToken(ctx, p.token);
        };
      })(this)).then((function(_this) {
        return function(trip_info) {
          var bad_token;
          _log.debug(f, 'got round trip:', trip_info);
          trip = trip_info;
          bad_token = trip_info.status === 'unknown' || trip_info.status !== 'valid';
          if (bad_token) {
            throw new E.AccessDenied('AUTH:VERIFY_EMAIL:INVALID_TOKEN');
          }
          if (trip.domain !== 'update_email') {
            throw new E.AccessDenied('AUTH:VERIFY_EMAIL:INVALID_DOMAIN');
          }
          new_eml = (JSON.parse(trip.json)).eml;
          return sdb.auth.GetById(ctx, trip.auth_ident_id);
        };
      })(this)).then((function(_this) {
        return function(db_rows) {
          _log.debug('got ident:', db_rows);
          if (db_rows.length !== 1) {
            throw new E.NotFoundError('AUTH:VERIFY_EMAIL:IDENT');
          }
          ident = db_rows[0];
          return sdb.auth.GetByCredName(ctx, new_eml);
        };
      })(this)).then((function(_this) {
        return function(db_rows) {
          _log.debug('got ident with new_eml:', db_rows);
          if (db_rows.length !== 0) {
            throw new E.AccessDenied('AUTH:VERIFY_EMAIL:EMAIL_EXISTS');
          }
          return sdb.auth.update_by_id(ctx, ident.id, {
            eml: new_eml
          });
        };
      })(this)).then((function(_this) {
        return function(db_result) {
          _log.debug(f, 'got password update result:', db_result);
          if (db_result.affectedRows !== 1) {
            throw new E.DbError('AUTH:VERIFY_EMAIL:AFFECTEDROWS');
          }
          return _this.tripMgr.returnFromTrip(ctx, trip.id);
        };
      })(this)).then((function(_this) {
        return function() {
          var recipient;
          recipient = {
            eml: new_eml
          };
          return _this.ses.send('email_change_confirmed', _this.make_tbl(recipient));
        };
      })(this)).then(function() {
        var success;
        success = true;
        return {
          send: {
            success: success
          }
        };
      });
    };

    AuthRoute.prototype._update_password = function(ctx, pre_loaded) {
      var conn, f, p, use_doc, _log;
      use_doc = {
        params: {
          pwd: 'r:S'
        },
        response: {
          success: 'bool'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_update_password:';
      p = ctx.p;
      conn = ctx.conn;
      _log = ctx.log;
      if (p.auid !== 'me') {
        if ((Number(p.auid)) !== pre_loaded.auth_id) {
          throw new E.AccessDenied('AUTH:UPDATE_PASSWORD:AUTH_ID');
        }
      }
      if (!p.pwd) {
        throw new E.MissingArg('pwd');
      }
      return Q.resolve().then((function(_this) {
        return function() {
          return _this.auth.EncryptPassword(p.pwd);
        };
      })(this)).then(function(pwd_hash) {
        return sdb.auth.update_by_id(ctx, pre_loaded.auth_id, {
          pwd: pwd_hash
        });
      }).then(function(db_result) {
        var success;
        _log.debug(f, 'got password update result:', db_result);
        if (db_result.affectedRows !== 1) {
          throw new E.DbError('AUTH:UPDATE_PASSWORD:AFFECTEDROWS');
        }
        success = true;
        return {
          send: {
            success: success
          }
        };
      });
    };

    AuthRoute.prototype._forgot_password = function(ctx, pre_loaded) {
      var f, ident, p, use_doc, _log;
      use_doc = {
        params: {
          eml: 'r:S'
        },
        response: {
          success: 'bool'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_forgot_password:';
      p = ctx.p;
      _log = ctx.log;
      ident = false;
      if (!p.eml) {
        throw new E.MissingArg('eml');
      }
      return Q.resolve().then((function(_this) {
        return function() {
          return sdb.auth.GetByCredName(ctx, p.eml);
        };
      })(this)).then((function(_this) {
        return function(db_rows) {
          _log.debug('got ident:', db_rows);
          if (db_rows.length !== 1) {
            throw new E.NotFoundError('AUTH:FORGOT_PASSWORD:IDENT');
          }
          ident = db_rows[0];
          return _this.tripMgr.planTrip(ctx, ident.id, {}, null, 'forgot_password');
        };
      })(this)).then((function(_this) {
        return function(new_trip) {
          var trip;
          _log.debug(f, 'got round trip:', new_trip);
          if (new_trip !== false) {
            trip = new_trip;
          }
          return _this.ses.send('forgot_password', _this.make_tbl(ident, trip.token, _this.config.ses.options, 'forgot_password', ctx));
        };
      })(this)).then(function() {
        var success;
        success = true;
        return {
          send: {
            success: success
          }
        };
      });
    };

    AuthRoute.prototype._verify_forgot = function(ctx, pre_loaded) {
      var f, p, success, trip, use_doc, _log;
      use_doc = {
        params: {
          pwd: 'r:S'
        },
        response: {
          success: 'bool'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_verify_forgot:';
      p = ctx.p;
      _log = ctx.log;
      trip = false;
      success = false;
      if (!p.pwd) {
        throw new E.MissingArg('pwd');
      }
      return Q.resolve().then((function(_this) {
        return function() {
          return _this.tripMgr.getTripFromToken(ctx, p.token);
        };
      })(this)).then((function(_this) {
        return function(trip_info) {
          var bad_token;
          _log.debug(f, 'got round trip:', trip_info);
          trip = trip_info;
          bad_token = trip_info.status === 'unknown' || trip_info.status !== 'valid';
          if (bad_token) {
            throw new E.AccessDenied('AUTH:AUTH_TRIP:INVALID_TOKEN');
          }
          if (trip.domain !== 'forgot_password') {
            throw new E.AccessDenied('AUTH:AUTH_TRIP:INVALID_DOMAIN');
          }
          return _this.auth.EncryptPassword(p.pwd);
        };
      })(this)).then((function(_this) {
        return function(pwd_hash) {
          return sdb.auth.update_by_id(ctx, trip.auth_ident_id, {
            pwd: pwd_hash
          });
        };
      })(this)).then((function(_this) {
        return function(db_result) {
          _log.debug(f, 'got password update result:', db_result);
          if (db_result.affectedRows !== 1) {
            throw new E.DbError('AUTH:UPDATE_PASSWORD:AFFECTEDROWS');
          }
          return _this.tripMgr.returnFromTrip(ctx, trip.id);
        };
      })(this)).then((function(_this) {
        return function() {
          success = true;
          return {
            send: {
              success: success
            }
          };
        };
      })(this));
    };

    AuthRoute.prototype._get_auth_trip = function(ctx, pre_loaded) {
      var bad_token, f, ident, p, trip, use_doc, _log;
      use_doc = {
        params: {},
        response: {
          ident: 'object'
        }
      };
      if (ctx === 'use') {
        return use_doc;
      }
      f = 'Auth:_auth_trip:';
      p = ctx.p;
      _log = ctx.log;
      bad_token = false;
      trip = false;
      ident = false;
      return Q.resolve().then((function(_this) {
        return function() {
          return _this.tripMgr.getTripFromToken(ctx, p.token);
        };
      })(this)).then((function(_this) {
        return function(trip_info) {
          _log.debug(f, 'got round trip:', trip_info);
          trip = trip_info;
          bad_token = trip_info.status === 'unknown' || trip_info.status !== 'valid';
          if (bad_token) {
            throw new E.AccessDenied('AUTH:AUTH_TRIP:BAD_TOKEN');
          }
          return sdb.auth.GetById(ctx, trip.auth_ident_id);
        };
      })(this)).then((function(_this) {
        return function(db_rows) {
          _log.debug('got ident:', db_rows);
          if (db_rows.length !== 1) {
            throw new E.NotFoundError('AUTH:AUTH_TRIP:IDENT');
          }
          ident = db_rows[0];
          ident.token = trip.token;
          return {
            send: {
              ident: ident
            }
          };
        };
      })(this));
    };

    AuthRoute.prototype._pl_ident = function(ctx) {
      var f;
      f = 'Auth:_pl_ident:';
      ctx.log.debug(f, ctx.p);
      return Q.resolve().then(function() {
        return sdb.auth.GetById(ctx, ctx.auth_id);
      }).then((function(_this) {
        return function(db_rows) {
          var ident;
          ctx.log.debug('got ident:', db_rows);
          if (db_rows.length !== 1) {
            throw new E.NotFoundError('AUTH:PRELOAD:IDENT');
          }
          return ident = db_rows[0];
        };
      })(this));
    };

    return AuthRoute;

  })();

  exports.AuthRoute = AuthRoute;

}).call(this);
