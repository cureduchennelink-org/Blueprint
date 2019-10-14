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
// Authentication Services
//
const Promise = require('bluebird');
/*
{pbkdf2, randomBytes}= require 'crypto'
crypto=
	pbkdf2: Promise.promisify pbkdf2
	randomBytes: Promise.promisify randomBytes
*/
const crypto = require('crypto');
crypto.p_pbkdf2 = Promise.promisify(crypto.pbkdf2, {context: crypto});
crypto.p_randomBytes = Promise.promisify(crypto.randomBytes, {
  context: crypto,
});

class Auth {
  static initClass() {
    this.deps = {
      services: ['error', 'config', 'tokenMgr'],
      config: [
        'auth[key,bearer,basic.api_keys,pbkdf2[iterations,salt_size,key_length]]',
      ],
      mysql: ['auth'],
    };
  }
  constructor(kit) {
    this.server_use = this.server_use.bind(this);
    this.sdb = kit.services.db.mysql;
    this.E = kit.services.error;
    this.config = kit.services.config.auth;
    this.tokenMgr = kit.services.tokenMgr;
    this.pwd_col = this.sdb.auth.pwd_col;
    this.ITERATIONS = this.config.pbkdf2.iterations;
    this.SALT_SIZE = this.config.pbkdf2.salt_size;
    this.KEY_LENGTH = this.config.pbkdf2.key_length;
  }

  _pbkdf2(p, buf, IT, KL) {
    return crypto.p_pbkdf2(p, buf, IT, KL, 'sha1');
  }

  // Request Authorization Parser
  server_use(req, res, next) {
    const p = req.params;
    const h = req.headers;
    let authHeader = false;
    let token = false;
    let result = false;

    if (h.authorization) {
      authHeader = h.authorization.split(' ', 2);
    }
    token =
      (authHeader != null ? authHeader.length : undefined) === 2 &&
      authHeader[0].toLowerCase() === 'bearer' ?
        authHeader[1] :
        p.auth_token;

    result = token ?
      this.tokenMgr.decodeAndValidate(token, this.config.key) :
      {error: 'Missing or invalid authorization header'};

    req.auth = {
      message: result.error,
      token: result.token,
      authId: result.token ? result.token.iid : null,
      tenant: result.token ? result.token.itenant : null,
      role: result.token ? result.token.irole : null,
      authorize: (skip_response) => {
        if (!req.auth.authId) {
          if (skip_response) {
            return false;
          }
          const error = new this.E.OAuthError(
              401,
              'invalid_token',
              req.auth.message
          );
          res.setHeader(
              'WWW-Authenticate',
              `Bearer realm=\"${this.config.bearer}\"`
          );
          res.send(error);
          return false;
        } else {
          return true;
        }
      },
    };
    return next();
  }

  // Requires server.use restify.authorizationParser()
  // 	- config: restify: handlers: ['authorizationParser']
  // returns true or 'error_string'
  // Add api_keys to config: auth: basic: api_keys: my_key: password: 'myPassword'
  AuthenticateBasicAuthHeader(req) {
    const f = 'Auth:AuthenticateBasicAuthHeader:';
    const auth = req.authorization;
    const {api_keys} = this.config.basic;
    if (auth.scheme !== 'Basic') {
      return 'invalid_scheme';
    }
    if (!((auth.basic != null ? auth.basic.username : undefined) in api_keys)) {
      return 'invalid_api_key';
    }
    if (
      (auth.basic != null ? auth.basic.password : undefined) !==
      (api_keys[auth.basic.username] != null ?
        api_keys[auth.basic.username].password :
        undefined)
    ) {
      return 'invalid_password';
    }
    return true;
  }

  ValidateCredentials(ctx, username, password) {
    const f = 'Auth:_ValidateCredentials:';
    let creds = false;

    return Promise.resolve()
        .bind(this)
        .then(function() {
        // Grab User Credentials
          return this.sdb.auth.GetAuthCreds(ctx, username);
        })
        .then(function(db_rows) {
          if (db_rows.length !== 1 || !db_rows[0][this.pwd_col]) {
            throw new this.E.OAuthError(401, 'invalid_client');
          }
          creds = db_rows[0];

          // Compare given password to stored hash password
          return this.ComparePassword(password, creds[this.pwd_col]);
        })
        .then(function(a_match) {
          if (!a_match) {
            throw new this.E.OAuthError(401, 'invalid_client');
          }
          return {id: creds.id, tenant: creds.tenant, role: creds.role};
        }); // Encodable in auth token
  }

  ComparePassword(password, compareHash) {
    const f = 'Auth:ComparePassword:';
    const parts = compareHash.split('.', 2);
    if (parts.length !== 2) {
      throw new this.E.ServerError(
          'auth_error',
          'Missing salt on password hash'
      );
    }

    return this._pbkdf2(
        password,
        new Buffer(parts[0], 'base64'),
        this.ITERATIONS,
        this.KEY_LENGTH
    ).then(function(key) {
      if (new Buffer(key).toString('base64') === parts[1]) {
        return true;
      } else {
        return false;
      }
    });
  }

  EncryptPassword(password) {
    let saltBuf = false;

    return Promise.resolve()
        .bind(this)
        .then(function() {
        // Create Salt
          return crypto.p_randomBytes(this.SALT_SIZE);
        })
        .then(function(buffer) {
          saltBuf = buffer;

          // Encrypt Password
          return this._pbkdf2(
              password,
              saltBuf,
              this.ITERATIONS,
              this.KEY_LENGTH
          );
        })
        .then(
            (key) =>
              saltBuf.toString('base64') + '.' + new Buffer(key).toString('base64')
        );
  }
}
Auth.initClass();

exports.Auth = Auth;
