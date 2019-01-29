/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Authentication Services
//

const Q= require('q');
const E= require('../lib/error');
const crypto= require('crypto');

let ITERATIONS= false;
let SALT_SIZE= false;
let KEY_LENGTH= false;

let sdb= false; // MySql DB

class Auth {
	constructor(kit) {
		this.server_use = this.server_use.bind(this);
		sdb= 		kit.services.db.mysql;
		this.log= 		kit.services.logger.log;
		this.config= 	kit.services.config.auth;
		this.tokenMgr= 	kit.services.tokenMgr;
		this.pwd_col= 	sdb.auth.pwd_col;
		ITERATIONS= this.config.pbkdf2.iterations;
		SALT_SIZE= 	this.config.pbkdf2.salt_size;
		KEY_LENGTH= this.config.pbkdf2.key_length;
	}

	_pbkdf2(p,buf,IT,KL){ return (Q.ninvoke(crypto, 'pbkdf2', p, buf, IT, KL)); }

	// Request Authorization Parser
	server_use(req, res, next){
		const p= req.params;
		const h= req.headers;
		let authHeader= false;
		let token= false;
		let result= false;

		if (h.authorization) { authHeader= h.authorization.split(' ', 2); }
		token= ((authHeader != null ? authHeader.length : undefined) === 2) && (authHeader[0].toLowerCase() === 'bearer')
		? authHeader[1]
		: p.auth_token;

		result= token
		? this.tokenMgr.decodeAndValidate(token, this.config.key)
		: {error: 'Missing or invalid authorization header'};

		req.auth= {
			message: result.error,
			token: result.token,
			authId: result.token ? result.token.iid : null,
			authorize: skip_response=> {
				if (!req.auth.authId) {
					if (skip_response) { return false; }
					const error= new E.OAuthError(401, 'invalid_token', req.auth.message);
					res.setHeader('WWW-Authenticate', `Bearer realm=\"${this.config.bearer}\"`);
					res.send(error);
					return next();
				} else { return true; }
			}
		};
		return next();
	}

	// Requires server.use restify.authorizationParser()
	// 	- config: restify: handlers: ['authorizationParser']
	// returns true or 'error_string'
	// Add api_keys to config: auth: basic: api_keys: my_key: password: 'myPassword'
	AuthenticateBasicAuthHeader(req){
		const f= 'Auth:AuthenticateBasicAuthHeader:';
		const auth= req.authorization;
		const { api_keys }= this.config.basic;
		if (auth.scheme !== 'Basic') { return 'invalid_scheme'; }
		if (!((auth.basic != null ? auth.basic.username : undefined) in api_keys)) { return 'invalid_api_key'; }
		if ((auth.basic != null ? auth.basic.password : undefined) !== (api_keys[auth.basic.username] != null ? api_keys[auth.basic.username].password : undefined)) { return 'invalid_password'; }
		return true;
	}

	ValidateCredentials(ctx, username, password){
		const f= 'Auth:_ValidateCredentials:';
		const _log= ctx.log != null ? ctx.log : this.log;
		let creds= false;

		return Q.resolve()
		.then(() =>

			// Grab User Credentials
			sdb.auth.GetAuthCreds(ctx, username)).then(db_rows=> {
			if ((db_rows.length !== 1) || !db_rows[0][this.pwd_col]) {
				throw new E.OAuthError(401, 'invalid_client');
			}
			creds= db_rows[0];

			// Compare given password to stored hash password
			return this.ComparePassword(password, creds[this.pwd_col]);
		})
		.then(function(a_match){
			if (!a_match) { throw new E.OAuthError(401, 'invalid_client'); }
			return creds.id;
		});
	}


	ComparePassword(password, compareHash){
		const f= 'Auth:ComparePassword:';
		const parts= compareHash.split('.', 2);
		if (parts.length !== 2) { throw new E.ServerError('auth_error','Missing salt on password hash'); }

		return (this._pbkdf2(password, new Buffer(parts[0], 'base64'), ITERATIONS, KEY_LENGTH))
		.then(key=> {
			if ((new Buffer(key).toString('base64')) === parts[1]) { return true; } else { return false; }
		});
	}

	EncryptPassword(password){
		let saltBuf= false;

		return Q.resolve()
		.then(() =>

			// Create Salt
			Q.ninvoke(crypto, 'randomBytes', SALT_SIZE)).then(buffer=> {
			saltBuf= buffer;

			// Encrypt Password
			return this._pbkdf2(password, saltBuf, ITERATIONS, KEY_LENGTH);
		}).then(key=> (saltBuf.toString('base64')) + '.' + new Buffer(key).toString('base64'));
	}
}

exports.Auth= Auth;