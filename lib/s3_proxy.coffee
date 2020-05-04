#
# S3Proxy - A class to allow 'Clients' to upload to S3 securly, by providing a 'signed' URL
#
# TODO Write some unit tests for these (even maybe some integration tests to confirm S3 signatures and calls
# TODO Write better documentation for callers
# TODO Better docs / examples for code on client side that must consume these POST/GET URLs
#
Promise = require("bluebird")
AWS = require('aws-sdk')
crypto = require 'crypto'

class S3Proxy

	@deps= services:[ 'config', ], config: 's3_creds[secretKey,accessKey,bucket,endpoint,region]'

	constructor: (kit)->
		f = 'S3Proxy:constructor'
		@config = kit.services.config.s3_creds
		AWS.config.update accessKeyId: @config.accessKey, secretAccessKey: @config.secretKey, region: @config.region
		@s3 = new AWS.S3 apiVersion: '2006-03-01'
		@s3_getSignedUrl = Promise.promisify(@s3.getSignedUrl).bind @s3
		@s3_putObject = Promise.promisify(@s3.putObject).bind @s3
		@s3_deleteObject = Promise.promisify(@s3.deleteObject).bind @s3

	# PUBLIC: Given {filename, content_type} return URL for client's POST, and params (e.g. header values, etc.) for proper upload
	s3Credentials: (ctx, params) =>
		result=
			endpoint_url: @config.endpoint
			params: @_s3Params params
		ctx.log.debug f, {params, result}
		result

	# PUBLIC: Given 'key' (path to an object in the bucket) ond opptionaly expiration and bucket, return URL for client's GET that has the given expiration
 	# expires e.g. 60 * 60 = 1 hour for download/playback
	s3GetUrl: (ctx, key, expires= 60* 60, bucket= @config.bucket) =>
		f= 'S3Proxy:s3GetUrl'
		params= Bucket: bucket, Key: key, Expires: expires
		ctx.log.debug f, params
		@s3_getSignedUrl 'getObject', params

	# PUBLIC: One deep module that utilizes putObject in a variety of use cases
	# contest_type e.g. 'image/jpeg', 'application/pdf'
	s3UploadBuffer: (ctx, buffer, key, content_type, bucket= @config.bucket)=>
		f= 'S3Proxy:s3UploadBuffer'
		params=
			Bucket: bucket
			Key: key
			ContentEncoding: 'buffer',
			ContentType: content_type
			ACL: 'public-read'
		ctx.log.debug f, params
		params.Body= buffer

		# CRB: 10/16/2018, there is nothing valuable in the response of putObject
		# Generate the url of the stored image to return to function that called this function
		@s3_putObject params
		.then ->
			"https://s3.amazonaws.com/#{bucket}/#{key}"

	# PUBLIC:
	s3RemoveFile: (ctx, key, bucket= @config.bucket) =>
		f= 'S3Proxy:s3RemoveFile'
		send= { success: false }
		params=
			Bucket: bucket
			Key: key
		ctx.log.debug f, params

		# CRB 08/20/18: Because we are not doing any versioning on our S3 Objects,
		# the returned data argument here returns an empty object
		@s3.deleteObject params
		.then ->
			"https://s3.amazonaws.com/#{bucket}/#{key}"

	# Returns the parameters that must be passed to the API call
	_s3Params: (params) =>
		credential= @_amzCredential()
		policy = @_s3UploadPolicy params, credential
		policyBase64 = new Buffer(JSON.stringify policy).toString('base64')
		details=
			key: params.filename
			acl: if @config.encrypted then 'bucket-owner-full-control' else 'public-read'
			success_action_status: '201'
			policy: policyBase64
			'Content-Type': params.contentType
			'x-amz-algorithm': 'AWS4-HMAC-SHA256'
			'x-amz-credential': credential
			'x-amz-date': @_dateString() + 'T000000Z'
			'x-amz-signature': @_s3UploadSignature policyBase64, credential
		details['x-amz-server-side-encryption']= 'AES256' if @config.encrypted
		details

	_dateString: ->
		date = (new Date).toISOString()
		date.substr(0, 4) + date.substr(5, 2) + date.substr(8, 2)

	_amzCredential: () ->
		[@config.accessKey, @_dateString(), @config.region, 's3/aws4_request'].join '/'

	# Constructs the policy
	_s3UploadPolicy: (params, credential)=>
		expiration= new Date((new Date).getTime() + 5* 60 * 1000).toISOString() # Upload expires in 5 min
		conditions= [
			{bucket: @config.bucket}
			{key: params.filename}
			{acl: if @config.encrypted then 'bucket-owner-full-control' else 'public-read'}
			{success_action_status: '201'}
			['starts-with', '$Content-Type', '']
			['content-length-range', 0, 5000000000]
			{'x-amz-algorithm': 'AWS4-HMAC-SHA256'}
			{'x-amz-credential': credential}
			{'x-amz-date': @_dateString() + 'T000000Z'}
		]
		conditions.push ['eq', '$x-amz-server-side-encryption', 'AES256'] if @config.encrypted
		{ expiration, conditions }

	_hmac: (key, string) ->
		self = crypto.createHmac 'sha256', key
		self.end string
		self.read()

	# Signs the policy with the credential
	_s3UploadSignature: (policyBase64, credential) ->
		dateKey = @_hmac 'AWS4' + @config.secretKey, @_dateString()
		dateRegionKey = @_hmac dateKey, @config.region
		dateRegionServiceKey = @_hmac dateRegionKey, 's3'
		signingKey = @_hmac dateRegionServiceKey, 'aws4_request'
		@_hmac(signingKey, policyBase64).toString 'hex'

exports.S3Proxy= S3Proxy
