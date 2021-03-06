// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Amazon SES Module
//

const Promise= require('bluebird');
const AWS= require('aws-sdk');
const _= require('lodash');

class SES {
	static deps() {
		return {services: ['logger','template','config'], config: 'ses[accessKeyId,secretAccessKey,region,emails[],debug_email,default{}]'};
	}
	constructor(kit) {
		this.log= kit.services.logger.log;
		this.config= kit.services.config.ses;
		AWS.config.update({
			accessKeyId: this.config.accessKeyId,
			secretAccessKey: this.config.secretAccessKey,
			region: this.config.region
		});
		this.ses= new AWS.SES();
		this.template= kit.services.template;
		this.sendEmailAsPromised= Promise.promisify(this.ses.sendEmail, {context: this.ses});
	}

	send(type, data){
		const spec= this.config.emails[type];
		const message= this._composeMsgFrom(spec, data);
		this.log.debug('SES:send:', 'sending message:', message);
		return this.sendEmailAsPromised(message);
	}

	_composeMsgFrom(spec, data){
		const f= 'SES._composeMsgFrom:';
		this.log.debug(f, spec, data);

		const eml_attributes = _.merge({}, spec, data);

		let send_to= false;
		if (this.config.debug_email !== false) {
			send_to= this.config.debug_email;
		} else {
			const recipient= eml_attributes.Recipient[0];
			send_to= typeof recipient === 'string' ? recipient : recipient.eml;
		}

		// Email Message
		return {
			Destination: { // required
				ToAddresses: [ send_to ], // Takes a list
				BccAddresses: eml_attributes.BccAddresses != null ? eml_attributes.BccAddresses : this.config.default.BccAddresses,
				CcAddresses: eml_attributes.CcAddresses != null ? eml_attributes.CcAddresses : this.config.default.CcAddresses
			},
			Source: eml_attributes.Source != null ? eml_attributes.Source : this.config.default.Source,
			ReplyToAddresses: eml_attributes.ReplyToAddresses != null ? eml_attributes.ReplyToAddresses : this.config.default.ReplyToAddresses,
			ReturnPath: eml_attributes.ReturnPath != null ? eml_attributes.ReturnPath : this.config.default.ReturnPath,
			Message: { // required
				Subject: { // required
					Data: eml_attributes.Subject != null ? eml_attributes.Subject : 'Default Email Subject'
				},
					//Charset: 'STRING_VALUE'
				Body: { // required
					Html: {
						Data: this.template.render(eml_attributes.model, eml_attributes.tmpl, eml_attributes.page, data)
					},
						//Charset: 'STRING_VALUE'
					Text: {
						Data: eml_attributes.Text != null ? eml_attributes.Text : 'Default Email Text'
					}
				}
			}
		};
	}
}
					//Charset: 'STRING_VALUE'

exports.SES= SES;
