#
#	Amazon SES Module
#

Promise= require 'bluebird'
AWS= require 'aws-sdk'

class SES
	@deps: services: ['logger','template','config'], config: 'ses[accessKeyId,secretAccessKey,region,emails[],debug_email,default{}]'
	constructor: (kit) ->
		@log= kit.services.logger.log
		@config= kit.services.config.ses
		AWS.config.update
			accessKeyId: @config.accessKeyId
			secretAccessKey: @config.secretAccessKey
			region: @config.region
		@ses= new AWS.SES()
		@template= kit.services.template

	send: (type, data)->
		spec= @config.emails[type]
		message= @_composeMsgFrom spec, data
		@log.debug 'SES:send:', 'sending message:', message
		Promise.fromNode @ses, 'sendEmail', message

	_composeMsgFrom: (spec, data)->
		f= 'SES._composeMsgFrom:'
		@log.debug f, spec, data
		send_to= false
		if @config.debug_email isnt off
			send_to= @config.debug_email
		else
			recipient= data.Recipient[0]
			send_to= if typeof recipient is 'string' then recipient else recipient.eml

		# Email Message
		Destination: # required
			ToAddresses: [ send_to ] # Takes a list
			BccAddresses: spec.BccAddresses ? @config.default.BccAddresses
			CcAddresses: spec.CcAddresses ? @config.default.CcAddresses
		Source: spec.Source ? @config.default.Source
		ReplyToAddresses: spec.ReplyToAddresses ? @config.default.ReplyToAddresses
		ReturnPath: spec.ReturnPath ? @config.default.ReturnPath
		Message: # required
			Subject: # required
				Data: spec.Subject ? 'Default Email Subject'
				#Charset: 'STRING_VALUE'
			Body: # required
				Html:
					Data: @template.render spec.model, spec.tmpl, spec.page, data
					#Charset: 'STRING_VALUE'
				Text:
					Data: spec.Text ? 'Default Email Text'
					#Charset: 'STRING_VALUE'

exports.SES= SES
