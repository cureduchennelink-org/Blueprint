/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Firebase service I/F
//
// Package.json: "firebase-admin": "^8.12.1",
// Original author: Derek
// Use: 'payload' is e.g. {notification: {body: 'some text'}, data: {key/values}} - either or both notificaiton/data are allowed
// Notes: See the MessagingDevicesResponse reference documentation
// Routes: Also need a route to collect tokens, store then, and use them in these calls (see r_firebase)
//
// ENV needs/sample
//  - Map config.firebase creds/databaseName to the environment, e.g.
//  export ${PREFIX}FIREBASE_DB=is_FIREBASE_DB_used
//  export PREFIXZ_FIREBASE_JSON=$(cat <<END
// {
// 	"type": "service_account",
// 	"project_id": "fishcompz-staging",
// 	"private_key_id": "a87c1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxf318f",
// 	"private_key": "-----BEGIN PRIVATE KEY-----\line1\nline2\netc...\nlast_line=\n-----END PRIVATE KEY-----\n",
// 	"client_email": "firebase-adminsdk-x4h3n@fishcompz-staging.iam.gserviceaccount.com",
// 	"client_id": "117380000000000000061",
// 	"auth_uri": "https://accounts.google.com/o/oauth2/auth",
// 	"token_uri": "https://oauth2.googleapis.com/token",
// 	"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
// 	"client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-x4h3n%40fishcompz-staging.iam.gserviceaccount.com"
// }
// END
//  - Note: for Jenkins, may need to put a backslash before '$(cat' if you also do a cat.
//  - Note: For mocha, you cannot call admin.initializeApp twice, even in a new class, since 'admin= require()' is a global namespace
//
const admin = require('firebase-admin');
const Promise= 	require('bluebird');
const _= 	require('lodash');

// Auto-tests issue: Error: The default Firebase app already exists. This means you called initializeApp() more than once without providing an app name as the second argument. In most cases you only need to call initializeApp() once. But if you do want to initialize multiple apps, pass a second argument to initializeApp() to give each app a unique name.
let mocha_creates_class_more_than_once_per_process= true;

class Firebase {
	static initClass() {
		this.deps= {services: [ 'logger', 'error', 'config', ]};
	}
	constructor(kit){
		this.sendToDevice = this.sendToDevice.bind(this);
		this.sendToDeviceGroup = this.sendToDeviceGroup.bind(this);
		this.sendToTopic = this.sendToTopic.bind(this);
		this.sendToCondition = this.sendToCondition.bind(this);
		this.log= 	kit.services.logger.log;
		this.E= 	kit.services.error;
		const config= kit.services.config.firebase;
		if (mocha_creates_class_more_than_once_per_process === true) {
			mocha_creates_class_more_than_once_per_process= admin.initializeApp({
				credential: admin.credential.cert(JSON.parse(config.creds)),
				databaseURL: `https://${config.databaseName}.firebaseio.com`
			});
		}
	}

	sendToDevice(ctx, registrationTokens, payload){ return this._wrap(ctx, 'sendToDevice',          registrationTokens, payload, {check_no_tokens: true}); }
	sendToDeviceGroup(ctx, notificationKey,    payload){ return this._wrap(ctx, 'sendToDeviceGroup',     notificationKey,    payload); }
	sendToTopic(ctx, registrationTokens, payload){ return this._wrap(ctx, 'sendToDeviceTopic',     registrationTokens, payload); }
	sendToCondition(ctx, conditions,         payload){ return this._wrap(ctx, 'sendToDeviceCondition', conditions,         payload); }

	// Call the method, log everything, but don't throw an error (return true/false so caller know if succes or fail)
	_wrap(ctx, method, first_param, payload, options){
		const f= `Firebase:_wrap:${method}`;
		ctx.log.debug(f, {first_param, payload, options});

		if (options.check_no_tokens === true) {
			if (first_param.length === 0) { return; }
		}

		return Promise.resolve().bind(this)
		.then(() => admin.messaging()[ method](first_param, payload)).then(function(response){
			ctx.log.debug(f, {response});
			return true;}).catch(function(error) {
			ctx.log.debug(f, {error});
			return false;
		});
	}
}
Firebase.initClass();

exports.Firebase = Firebase;
