// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Token Manager
//
const Promise= require('bluebird');
const crypto = require('crypto');
const moment = require('moment');

// Some Utility Functions
const urlSafeBase64DecodeFix= str => str.replace(/-/g, '+').replace(/_/g, '/');

const urlSafeBase64EncodeFix= str => str.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=/g, '');

class TokenMgr {
	static deps() {
		return {services: []};
	}
	constructor(kit){
		this.CreateToken=( Promise.promisify(this.createToken)).bind(this);
	}

	createToken(length, callback){
		return crypto.randomBytes(length, function(err, buf){
			if (err) { return callback(err); }
			return callback(null, urlSafeBase64EncodeFix(buf.toString('base64')));
		});
	}

	encode(token, exp, key){
		token.exp= moment.isMoment(exp) ? exp.unix() : moment(exp).unix();
		const data= urlSafeBase64EncodeFix(new Buffer(JSON.stringify(token), 'utf8').toString('base64'));
		const hmac= crypto.createHmac('sha256', key);
		hmac.update(data);
		return data + '.' + urlSafeBase64EncodeFix(hmac.digest('base64'));
	}

	decodeAndValidate(rawToken, key){
		// Validate Token Structure
		const parts= rawToken.split('.', 2);
		if (parts.length !== 2) { return {error: 'Bad Format'}; }

		// Validate Token Signature
		const hmac= crypto.createHmac('sha256', key);
		hmac.update(parts[0]);
		const sig= urlSafeBase64EncodeFix(hmac.digest('base64'));
		if (sig !== parts[1]) { return {error: 'Bad Signature'}; }

		// Validate Token Expiration
		const token= JSON.parse((new Buffer((urlSafeBase64DecodeFix(parts[0])), 'base64')).toString('utf8'));
		if ((isNaN(token.exp)) || (token.exp < moment().unix())) {
			return {error: 'Token Expired'};
		}

		return {token};
	}
}

exports.TokenMgr= TokenMgr;
