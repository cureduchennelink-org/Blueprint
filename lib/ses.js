/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Amazon SES Module
//

const Q= require('q');
const AWS= require('aws-sdk');

class SES {
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
	}

	send(type, data){
		const spec= this.config.emails[type];
		const message= this._composeMsgFrom(spec, data);
		this.log.debug('SES:send:', 'sending message:', message);
		return Q.ninvoke(this.ses, 'sendEmail', message);
	}

	_composeMsgFrom(spec, data){
		const f= 'SES._composeMsgFrom:';
		this.log.debug(f, spec, data);
		let send_to= false;
		if (this.config.debug_email !== false) {
			send_to= this.config.debug_email;
		} else {
			const recipient= data.Recipient[0];
			send_to= typeof recipient === 'string' ? recipient : recipient.eml;
		}

		// Email Message
		return {
			Destination: { // required
				ToAddresses: [ send_to ], // Takes a list
				BccAddresses: spec.BccAddresses != null ? spec.BccAddresses : this.config.default.BccAddresses,
				CcAddresses: spec.CcAddresses != null ? spec.CcAddresses : this.config.default.CcAddresses
			},
			Source: spec.Source != null ? spec.Source : this.config.default.Source,
			ReplyToAddresses: spec.ReplyToAddresses != null ? spec.ReplyToAddresses : this.config.default.ReplyToAddresses,
			ReturnPath: spec.ReturnPath != null ? spec.ReturnPath : this.config.default.ReturnPath,
			Message: { // required
				Subject: { // required
					Data: spec.Subject != null ? spec.Subject : 'Default Email Subject'
				},
					//Charset: 'STRING_VALUE'
				Body: { // required
					Html: {
						Data: this.template.render(spec.model, spec.tmpl, spec.page, data)
					},
						//Charset: 'STRING_VALUE'
					Text: {
						Data: spec.Text != null ? spec.Text : 'Default Email Text'
					}
				}
			}
		};
	}
}
					//Charset: 'STRING_VALUE'

exports.SES= SES;