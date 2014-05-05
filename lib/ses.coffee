#
#	Amazon SES Module
#

Q= require 'q'
AWS= require 'aws-sdk'

class SES
	constructor: (kit) ->
		@log= kit.services.logger.log
		@config= kit.services.config.ses
		@log.info 'Initializing SES...'
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
		Q.ninvoke @ses, 'sendEmail', message

	_composeMsgFrom: (spec, data)->
		f= 'SES._composeMsgFrom:'
		@log.debug f, spec, data
		send_to= if @config.debug_email isnt false then @config.debug_email else data.Recipient[0]

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