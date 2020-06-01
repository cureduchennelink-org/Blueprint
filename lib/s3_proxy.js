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
// S3Proxy - A class to allow 'Clients' to upload to S3 securly, by providing a 'signed' URL
//
// TODO Write some unit tests for these (even maybe some integration tests to confirm S3 signatures and calls
// TODO Write better documentation for callers
// TODO Better docs / examples for code on client side that must consume these POST/GET URLs
//
const Promise = require("bluebird");
const AWS = require('aws-sdk');
const crypto = require('crypto');

class S3Proxy {
	static initClass() {
	
		this.deps= {services:[ 'config', ], config: 's3_creds[secretKey,accessKey,bucket,endpoint,region]'};
	}

	constructor(kit){
		this.s3Credentials = this.s3Credentials.bind(this);
		this.s3GetUrl = this.s3GetUrl.bind(this);
		this.s3UploadBuffer = this.s3UploadBuffer.bind(this);
		this.s3RemoveFile = this.s3RemoveFile.bind(this);
		this._s3Params = this._s3Params.bind(this);
		this._s3UploadPolicy = this._s3UploadPolicy.bind(this);
		const f = 'S3Proxy:constructor';
		this.config = kit.services.config.s3_creds;
		AWS.config.update({accessKeyId: this.config.accessKey, secretAccessKey: this.config.secretKey, region: this.config.region});
		this.s3 = new AWS.S3({apiVersion: '2006-03-01'});
		this.s3_getSignedUrl = Promise.promisify(this.s3.getSignedUrl).bind(this.s3);
		this.s3_putObject = Promise.promisify(this.s3.putObject).bind(this.s3);
		this.s3_deleteObject = Promise.promisify(this.s3.deleteObject).bind(this.s3);
	}

	// PUBLIC: Given {filename, content_type} return URL for client's POST, and params (e.g. header values, etc.) for proper upload
	s3Credentials(ctx, params) {
		const f= 'S3Proxy:s3Credentials';
		const result= {
			endpoint_url: this.config.endpoint,
			params: this._s3Params(params)
		};
		ctx.log.debug(f, {params, result});
		return result;
	}

	// PUBLIC: Given 'key' (path to an object in the bucket) ond opptionaly expiration and bucket, return URL for client's GET that has the given expiration
 	// expires e.g. 60 * 60 = 1 hour for download/playback
	s3GetUrl(ctx, key, expires, bucket) {
		if (expires == null) { expires = 60* 60; }
		if (bucket == null) { ({
            bucket
        } = this.config); }
		const f= 'S3Proxy:s3GetUrl';
		const params= {Bucket: bucket, Key: key, Expires: expires};
		ctx.log.debug(f, params);
		return this.s3_getSignedUrl('getObject', params);
	}

	// PUBLIC: One deep module that utilizes putObject in a variety of use cases
	// contest_type e.g. 'image/jpeg', 'application/pdf'
	s3UploadBuffer(ctx, buffer, key, content_type, bucket){
		if (bucket == null) { ({
            bucket
        } = this.config); }
		const f= 'S3Proxy:s3UploadBuffer';
		const params= {
			Bucket: bucket,
			Key: key,
			ContentEncoding: 'buffer',
			ContentType: content_type,
			ACL: 'public-read'
		};
		ctx.log.debug(f, params);
		params.Body= buffer;

		// CRB: 10/16/2018, there is nothing valuable in the response of putObject
		// Generate the url of the stored image to return to function that called this function
		return this.s3_putObject(params)
		.then(() => `https://s3.amazonaws.com/${bucket}/${key}`);
	}

	// PUBLIC:
	s3RemoveFile(ctx, key, bucket) {
		if (bucket == null) { ({
            bucket
        } = this.config); }
		const f= 'S3Proxy:s3RemoveFile';
		const send= { success: false };
		const params= {
			Bucket: bucket,
			Key: key
		};
		ctx.log.debug(f, params);

		// CRB 08/20/18: Because we are not doing any versioning on our S3 Objects,
		// the returned data argument here returns an empty object
		return this.s3.deleteObject(params)
		.then(() => `https://s3.amazonaws.com/${bucket}/${key}`);
	}

	// Returns the parameters that must be passed to the API call
	_s3Params(params) {
		const credential= this._amzCredential();
		const policy = this._s3UploadPolicy(params, credential);
		const policyBase64 = new Buffer(JSON.stringify(policy)).toString('base64');
		const details= {
			key: params.filename,
			acl: this.config.encrypted ? 'bucket-owner-full-control' : 'public-read',
			success_action_status: '201',
			policy: policyBase64,
			'Content-Type': params.content_type,
			'x-amz-algorithm': 'AWS4-HMAC-SHA256',
			'x-amz-credential': credential,
			'x-amz-date': this._dateString() + 'T000000Z',
			'x-amz-signature': this._s3UploadSignature(policyBase64, credential)
		};
		if (this.config.encrypted) { details['x-amz-server-side-encryption']= 'AES256'; }
		return details;
	}

	_dateString() {
		const date = (new Date).toISOString();
		return date.substr(0, 4) + date.substr(5, 2) + date.substr(8, 2);
	}

	_amzCredential() {
		return [this.config.accessKey, this._dateString(), this.config.region, 's3/aws4_request'].join('/');
	}

	// Constructs the policy
	_s3UploadPolicy(params, credential){
		const expiration= new Date((new Date).getTime() + (5* 60 * 1000)).toISOString(); // Upload expires in 5 min
		const conditions= [
			{bucket: this.config.bucket},
			{key: params.filename},
			{acl: this.config.encrypted ? 'bucket-owner-full-control' : 'public-read'},
			{success_action_status: '201'},
			['starts-with', '$Content-Type', ''],
			['content-length-range', 0, 5000000000],
			{'x-amz-algorithm': 'AWS4-HMAC-SHA256'},
			{'x-amz-credential': credential},
			{'x-amz-date': this._dateString() + 'T000000Z'}
		];
		if (this.config.encrypted) { conditions.push(['eq', '$x-amz-server-side-encryption', 'AES256']); }
		return { expiration, conditions };
	}

	_hmac(key, string) {
		const self = crypto.createHmac('sha256', key);
		self.end(string);
		return self.read();
	}

	// Signs the policy with the credential
	_s3UploadSignature(policyBase64, credential) {
		const dateKey = this._hmac('AWS4' + this.config.secretKey, this._dateString());
		const dateRegionKey = this._hmac(dateKey, this.config.region);
		const dateRegionServiceKey = this._hmac(dateRegionKey, 's3');
		const signingKey = this._hmac(dateRegionServiceKey, 'aws4_request');
		return this._hmac(signingKey, policyBase64).toString('hex');
	}
}
S3Proxy.initClass();

exports.S3Proxy= S3Proxy;
