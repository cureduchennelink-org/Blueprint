#
#	Amazon SES Module
#

Promise= require 'bluebird'
AWS= require 'aws-sdk'
_= require 'lodash'
htmlToText = require 'html-to-text'

class SES
	@deps: 
		services: ['logger','template','config'], 
		config: 'ses[accessKeyId,secretAccessKey,region,emails[],debug_email,default{}]'
	constructor: (kit) ->
		@log= kit.services.logger.log
		@config= kit.services.config.ses
		AWS.config.update
		  accessKeyId: @config.accessKeyId
		  secretAccessKey: @config.secretAccessKey
		  region: @config.region
		@ses= new AWS.SES()
		@template= kit.services.template
		@sendEmailAsPromised= Promise.promisify @ses.sendEmail, context: @ses

	send: (type, data)->
		spec= @config.emails[type]
		message= @_composeMsgFrom spec, data
		@log.debug 'SES-CUSTOM:send:', 'sending message:', message
		@sendEmailAsPromised message

	_composeMsgFrom: (spec, data)->
		f= 'SES-CUSTOM._composeMsgFrom:'
		@log.debug f, spec, data

		eml_attributes = _.merge {}, spec, data

		send_to= false
		if @config.debug_email isnt off
			send_to= @config.debug_email
		else
			recipient= eml_attributes.Recipient[0]
			send_to= if typeof recipient is 'string' then recipient else recipient.eml

		email_content = @template.render eml_attributes.model, eml_attributes.tmpl, eml_attributes.page, data

		email_content_text = htmlToText.fromString email_content

		# Email Message
		Destination: # required
		  ToAddresses: [ send_to ] # Takes a list
		  BccAddresses: eml_attributes.BccAddresses ? @config.default.BccAddresses
		  CcAddresses: eml_attributes.CcAddresses ? @config.default.CcAddresses
		Source: eml_attributes.Source ? @config.default.Source
		ReplyToAddresses: eml_attributes.ReplyToAddresses ? @config.default.ReplyToAddresses
		ReturnPath: eml_attributes.ReturnPath ? @config.default.ReturnPath
		Message: # required
			Subject: # required
				Data: eml_attributes.Subject ? 'Default Email Subject'
				#Charset: 'STRING_VALUE'
		Body: # required
			Html:
				Data: email_content
				#Charset: 'STRING_VALUE'
			Text:
				Data: email_content_text ? 'Default Email Text'
				#Charset: 'STRING_VALUE'

exports.SES= SES
