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
const crypto = require('crypto');
crypto.promisePbkdf2 = Promise.promisify(crypto.pbkdf2, {context: crypto});
crypto.promiseRandomBytes = Promise.promisify(crypto.randomBytes, {
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
    this.resource = 'Auth';
    this.serverUse = this.serverUse.bind(this);
    this.db = kit.services.db.mysql;
    this.E = kit.services.error;
    this.log = kit.services.logger.log;
    this.config = kit.services.config.auth;
    this.tokenMgr = kit.services.tokenMgr;
    this.pwdCol = this.db.auth.pwd_col;
    this.ITERATIONS = this.config.pbkdf2.iterations;
    this.SALT_SIZE = this.config.pbkdf2.salt_size;
    this.KEY_LENGTH = this.config.pbkdf2.key_length;
  }

  // Request Authorization Parser
  serverUse(req, res, next) {
    const {params, headers} = req;
    // TODO: FIX CAMEL CASE
    const {auth_token} = params;
    let authHeader = false;
    let token = false;
    let result = false;

    if (headers.authorization) {
      authHeader = headers.authorization.split(' ', 2);
    }

    if (authHeader && authHeader.length === 2) {
      token = authHeader[0].toLowerCase() === 'bearer' ? authHeader[0] : auth_token;
    }

    if (!token) {
      throw new Error('Missing or invalid authorization header');
    }
    result = this.tokenMgr.decodeAndValidate(token, this.config.key);

    req.auth = {
      message: result.error,
      token: result.token,
      authId: result.token ? result.token.iid : null,
      tenant: result.token ? result.token.itenant : null,
      role: result.token ? result.token.irole : null,
      authorize: (skipResponse) => {
        if (!req.auth.authId) {
          if (skipResponse) {
            return false;
          }
          const error = new this.E.OAuthError(
              401,
              'INVALID TOKEN',
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
  // - config: restify: handlers: ['authorizationParser']
  // returns true or 'error_string'
  // Add api_keys to config:
  // auth: basic: api_keys: my_key: password: 'myPassword'
  authenticateBasicAuthHeader(req) {
    const f = `${this.resource}:authenticateBasicAuthHeader::`;
    const {authorization} = req;

    if (!authorization) {
      return 'MISSING PARAMETER - AUTHORIZATION';
    }

    const {scheme, basic} = authorization;

    if (!basic) {
      return 'MISSING PARAMETER - BASIC';
    }

    const {username, password} = basic;
    const {apiKeys} = this.config.basic;

    if (scheme !== 'Basic') {
      return 'INVALID SCHEME';
    }

    if (!(username in apiKeys)) {
      return 'INVALID API KEY';
    }

    if (password !== apiKeys[username].password) {
      return 'INVALID PASSWORD';
    }

    return true;
  }

  async validateCredentials(ctx, username, password) {
    const f = `${this.resource}:validateCredentials::`;
    let creds = false;

    const dbRows = await this.db.auth.getAuthCreds(ctx, username);
    this.log.debug(f, {dbRows});
    if (dbRows.length !== 1 || !dbRows[0][this.pwdCol]) {
      throw new this.E.OAuthError(401, 'INVALID CLIENT');
    }

    [creds] = dbRows;
    const aMatch = await this._comparePassword(password, creds[this.pwdCol]);
    if (!aMatch) {
      throw new this.E.OAuthError(401, 'INVALID CLIENT');
    }

    return {
      id: creds.id,
      tenant: creds.tenant,
      role: creds.role,
    };
  }

  async _comparePassword(password, compareHash) {
    const f = `${this.resource}:_comparePassword::`;
    const parts = compareHash.split('.', 2);
    if (parts.length !== 2) {
      throw new this.E.ServerError('AUTH ERROR', 'MISSING SALT ON PASSWORD HASH');
    }

    const key = await crypto.promisePbkdf2(
        password,
        new Buffer(parts[0], 'base64'),
        this.ITERATIONS,
        this.KEY_LENGTH,
        'sha1'
    );

    if (new Buffer(key).toString('base64') === parts[1]) {
      return true;
    }

    return false;
  }

  async encryptPassword(password) {
    const buffer = await crypto.promiseRandomBytes(this.SALT_SIZE);
    const key = await crypto.promisePbkdf2(
        password,
        buffer,
        this.ITERATIONS,
        this.KEY_LENGTH,
        'sha1'
    );

    return `${buffer.toString('base64')}.${new Buffer(key).toString('base64')}`;
  }
}
Auth.initClass();

exports.Auth = Auth;
