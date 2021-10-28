//
// Service for DocuSign API (no domain knowledge)
//
//
// Caller must provide error handling and re-try logic with expected ctx
// DocuSign recommends separate Integration-keys (IK) for each integration
//  - They will troubleshoot each separately, with separate logs
//  - If they throttle requests, it would not affect the 'other' requests
//  - I am using just one IK at this time TODO
//
// Features:
//
//  Authentication:
//  - Handles OAuth request using a timestamped (iat) JWT
//  - supports concurrency using a promise
//  - caches and refreshes each hour (10 secs before expires)
//
//  Send envelope
//  - Caller gives details of who is to sign, and which template (1 of 4)
//  - TODO Can also stuff a custom value into the envelope
//  - Returns an envelope id that was created (for read call)
//  - TODO NEED TO STILL CREATE AND POPULATE A SECOND-NAME FIELD FOR ASSENT CHILD'S NAME (SOME ENVELOPES)
//
//  Read envelope
//  - Reads form-data from the envelope (fields that the user entered)
//
//  Webhook
//  - Provides the webhook endpoint and cleans the data to call back to domain logic
//  - FYI TEST: https://test-api.cureduchenne.deviq.io/api/v1 (then whatever we plan for)
//
const jwt = require('jsonwebtoken')
const docusignESign = require('docusign-esign')
const axiosWrap = require('./axios_wrap')
const Promise = require('bluebird')

/*
 * Instructions for a one-time browser based grant
 *
 * Log into the account, create the app (CDL Send Envelope) and copy UID,AID,BASE_URI, add our URI, generate/copy RSA
 * Put these values into .env, source that, and run these lines and follow the instructions echoed at the end, to 'consent' this app

# Sandbox OR Production - pick one and comment the other
STATIC_GRANT_ENDPOINT=https://account-d.docusign.com/oauth/token?
#STATIC_GRANT_ENDPOINT=https://account.docusign.com/oauth/token?
DYNAMIC_GRANT_REQUEST=\
$STATIC_GRANT_ENDPOINT\
response_type=code\
\&scope=$DOCUSIGN_BASE_SCOPES\
\&client_id=$DOCUSIGN_sendIK\
\&state=MY_CUSTOM_STATE\
\&redirect_uri=$DOCUSIGN_SEND_URI

echo $DYNAMIC_GRANT_REQUEST
echo Cut-n-paste that link into a browser, press 'accept' and copy the resulting redirect URL here:

# https://api.cureduchennelink.org/docusign_send_uri?code=eyJ0eXAiOiJNVCIsImFsZyI6IlJTMjU2Iiwia2lkIjoiNjgxODVmZjEtNGU1MS00Y2U5LWFmMWMtNjg5ODEyMjAzMzE3In0.AQsAAAABAAYABwAASWXO0OTYSAgAANXrFdHk2EgCAE9ssCOyhKpLsbtEqSKe3iQVAAEAAAAYAAIAAAAFAAAAHQAAAA0AJAAAAGEwMDEyMmUyLWI4YmQtNDUyZi1iOGM1LWNiMzU4NmJlNzQyZiIAJAAAAGEwMDEyMmUyLWI4YmQtNDUyZi1iOGM1LWNiMzU4NmJlNzQyZjAAAEllztDk2EgSAAEAAAALAAAAaW50ZXJhY3RpdmU3ALFAzQRbKlBDo9n4fjbJfqw.XOXHCyVhak1l0GlUoGfaN3wJC1aZADPvchTFkZe16XJkipQsCAGYsD4UEAALNa45Yiu6ZQHxBn5RsNtato2oZr65optFYcvQC5f8BHoAur0ssyMPjujuzx3OWDEyxzpbboVhwlRN_fVe-xMUBK-rywLGWJmYVNQPPiJDpcf8WnZZInZ-dtXg-5nyM-SzOffTU5Xt8_cg4ambCTpgbwyhdsR2RAjgl9GnxkI28_wGLB8mZWY5Apjg36oJ7fGYzEAOMTXl8QSC9oytBpCC3IZSwfsOkVOBpEHpqFJZv8BRNHt-F3YJgh2fKn_YhfT5tF07yTtf7a0pMd8XuKVYrzd5Rg&state=MY_CUSTOM_STATE

 *
 */
class Docusign {
	static deps() {
		return {
			services: ['logger', 'config'],
			config: '{baseScopes/Audience/OAuthEndpoint/UserId/AccountId/AccountUri,sendIK/Priv/Publ,httpOptions:{baseURL,timeout}}',
		}
	}
	constructor(kit) {
		this.config = kit.services.config.docusign

		// Use: const result= await agent( '/oauth/access_token', { params: {} }); // result.data.access_token
		this.makeAgent = axiosWrap({ timeout: 500 }, this.config.httpOptions)

		this.signOptions = {
			subject: this.config.baseUserId,
			algorithm: 'RS256',
			header: {},
		}
		this.accessTokenExpires = 0 // When < Date.now() it's time for a new one
	}
	// Update 'iat' for a time fresh request; used for the OAuth call specific to an IK
	_getFreshJWT(ctx) {
		const f = 'Docusign:_getFreshJWT'
		const nowSecs = Math.floor(Date.now() / 1000)
		const payload = {
			aud: this.config.baseAudience,
			scope: this.config.baseScopes,
			iss: this.config.sendIK,
			iat: nowSecs,
			exp: nowSecs + 3600,
		}
		const token = jwt.sign(payload, this.config.sendPriv, this.signOptions)
		return token
	}
	// Smoke test
	decode(theJWT) {
		return jwt.decode(theJWT, { complete: true })
	}
	// To get an access token (good for 1 hr, no refresh_token, so redo this request each hour with updated iat value in JWT
	async _getAccessToken(ctx) {
		const f = 'Docusign::_getAccessToken'
		if (this.accessTokenExpires === true || this.accessTokenExpires > Date.now())
			return this.accessTokenPromise
		// Time to refresh (gaurd logic from multiple users)
		let resolve, reject
		this.accessTokenExpires = true
		const promise = (this.accessTokenPromise = new Promise((s, j) => {
			resolve = s
			reject = j
		}))

		const agent = this.makeAgent(ctx)
		agent(this.config.baseOAuthEndpoint, {
			method: 'POST',
			params: {
				grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
				assertion: this._getFreshJWT(ctx),
			},
		})
			.then((result) => {
				// {"access_token":"...","token_type":"Bearer","expires_in":3600}
				this.accessTokenExpires = Date.now() + (result.data.expires_in - 10) * 1000
				resolve(result.data.access_token)
			})
			.catch((err) => {
				this.accessTokenExpires = 0 // Errors reset to 'try again'
				reject(err)
			})
		return this.accessTokenPromise
	}
	async _getApiClient(ctx) {
		const f = 'Docusign::_getApiClient: '
		const accessToken = await this._getAccessToken(ctx) // Refreshes each hour
		ctx.log.debug(f, { accessToken })
		let dsApiClient = new docusignESign.ApiClient()
		dsApiClient.setBasePath(this.config.baseAccountUri)
		dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken)
		return dsApiClient
	}
	// Create an 'envelope' (i.e. add specific recipients) from a 'template' (created in the wizard)
	// TODO SOLVE SENDING THE CHILD NAME INTO THE TEMPLATE - LIKE AS CUSTOM FIELD?  (I.E. CONSIDER IF WE CAN INJECT THE PARTICIPANT NAME INTO THE SUBJECT LINE PER IRB)
	// TODO ADD PID TO A HIDDEN CUSTOM FIELD
	_makeEnvelope(ctx, templateId, templateValues, subjectLine, signer1, signer2) {
		const f = 'Docusign::_makeEnvelope: '

		// Create template "role" elements to connect the signer and co-signer recipients to the template
		// We're setting the parameters via the object creation
		let role1 = docusignESign.TemplateRole.constructFromObject(signer1)
		let role2 = docusignESign.TemplateRole.constructFromObject(signer2)

		// create the envelope definition
		let env = new docusignESign.EnvelopeDefinition()
		env.templateId = templateId
		env.templateRoles = [role1, role2]
		env.customFields = templateValues // i.e. textCustomFields:[{name: 'ParticipantID', value: 'whatever'}]
		env.status = 'sent' // We want the envelope to be sent
		if (subjectLine) env.emailSubject = subjectLine

		return env
	}
	async sendEnvelope(ctx, templateId, templateValues, subjectLine, signer1, signer2) {
		const f = 'Docusign::sendEnvelope'
		ctx.log.debug(f, { templateId, templateValues, signer1, signer2 })

		const dsApiClient = await this._getApiClient(ctx)
		let envelopesApi = new docusignESign.EnvelopesApi(dsApiClient)
		let envelope = this._makeEnvelope(ctx, templateId, templateValues, subjectLine, signer1, signer2)
		let results = await envelopesApi.createEnvelope(this.config.baseAccountId, {
			envelopeDefinition: envelope,
		})
		return results
	}
	async voidEnvelope(ctx, envelopeId, voidedReason) {
		const f = 'Docusign::voidEnvelope'
		ctx.log.debug(f, { envelopeId, voidedReason })

		const dsApiClient = await this._getApiClient(ctx)
		let envelopesApi = new docusignESign.EnvelopesApi(dsApiClient)
		const envelope = { status: 'voided', voidedReason, }
		try {
			let results = await envelopesApi.update(this.config.baseAccountId, envelopeId, { envelope, })
			return results
		} catch (err) {
			return err.response.body
		}
	}
	// results.formData is [ { name: 'Choose: Completing additional surveys', value: 'YES' }... ]
	async getFormData(ctx, envelopeId) {
		const f = 'Docusign::getFormData'
		const dsApiClient = await this._getApiClient(ctx)
		let envelopesApi = new docusignESign.EnvelopesApi(dsApiClient)
		let results = await envelopesApi.getFormData(this.config.baseAccountId, envelopeId)
		return results
	}
	setHookCallback(ctx, callback) {
		this.hookCallback = callback
	}
	// TODO Figure out what is in the request and get the results back to the 'domain' side
	async hookInbound(ctx, inboundData) {
		const f = 'Docusign::hookInbound'
		// TODO WHAT IF THE DOMAIN SIDE NEVER HOOKED UP?
		if (this.hookCallback) {
			const results = this.hookCallback(ctx, inboundData)
			return results
		}
		return false
	}
}
exports.Docusign = Docusign
