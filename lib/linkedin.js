// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Linkedin Service
//

const Promise = require('bluebird');
const request = require('request-promise');
const querystring = require('querystring');

class Linkedin {
	static initClass() {
		this.deps = {services: ['error', 'logger', 'auth', 'config']};
	}
	constructor(kit){
		this.get_access_token = this.get_access_token.bind(this);
		this.get_linkedin_user = this.get_linkedin_user.bind(this);
		this.get_linkedin_user_email = this.get_linkedin_user_email.bind(this);
		this.E = kit.services.error;
		this.log = kit.services.logger.log;
		this.auth = kit.services.auth;
		this.config = kit.services.config;
	}

	get_access_token(ctx, authorization_code){
		const f = 'Linkedin:_get_access_token';
		const _log = ctx.log;
		const data = querystring.stringify({
			grant_type: 'authorization_code',
			code: authorization_code,
			redirect_uri: this.config.ses.options.urlPrefix + "/linkedinreturn",
			client_id: this.config.linkedin.client_id,
			client_secret: this.config.linkedin.client_secret
		});
		const opts = {
			uri: 'https://www.linkedin.com/oauth/v2/accessToken',
			method: 'POST',
			headers: {
				'Content-Length': Buffer.byteLength(data)
			},
			json: true,
			form: data
		};
		_log.debug(f, opts);
		return request(opts).then(function(data){
			_log.debug(data);
			return data;}).catch(e=> {
			return this.handleErrors(ctx, e);
		});
	}


	get_linkedin_user(ctx, accessToken){
		const f = 'Linkedin:_get_linkedin_user';
		const opts = {
			uri: 'https://api.linkedin.com/v2/me?projection=(id,firstName,lastName,profilePicture(displayImage~:playableStreams))',
			method: 'GET',
			headers: {
				Connection: 'Keep-Alive',
				Authorization: 'Bearer ' + accessToken
			},
			json: true
		};

		this.log.debug(f, opts);
		return request(opts).then(data=> {
			this.log.debug(f, { data });
			return data;
	}).catch(e=> {
			return this.handleErrors(ctx, e);
		});
	}

	get_linkedin_user_email(ctx, accessToken){
		const f = 'Linkedin:get_linkedin_user_email';
		const opts = {
			uri: 'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
			method: 'GET',
			headers: {
				Connection: 'Keep-Alive',
				Authorization: 'Bearer ' + accessToken
			},
			json: true
		};
		this.log.debug(f, opts);
		return request(opts).then(data=> {
			this.log.debug(f, { data });
			return data;
	}).catch(e=> {
			return this.handleErrors(ctx, e);
		});
	}

	handleErrors(ctx, e){
		const f= "Linkedin::handleErrors";
		ctx.log.error(f, {e});
		throw new this.E.ServerError(f, e);
	}
}
Linkedin.initClass();

exports.Linkedin = Linkedin;
