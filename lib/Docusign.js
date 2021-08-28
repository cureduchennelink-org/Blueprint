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
//  - supports concurency using a promise
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
const docusign_esign = require('docusign-esign')
const axios_wrap = require('./axios_wrap')
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
\&client_id=$DOCUSIGN_SEND_IK\
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
            config: '{base_scopes/_audience/_oauth_endpoint/_user_id/_account_id/_account_uri,send_ik/_priv/_publ,http_options:{baseURL,timeout}}',
        }
    }
    constructor(kit) {
        this.config = kit.services.config.docusign

        // Use: const result= await agent( '/oauth/access_token', { params: {} }); // result.data.access_token
        this.make_agent = axios_wrap({ timeout: 500 }, this.config.http_options)

        this.sign_options = {
            subject: this.config.base_user_id,
            algorithm: 'RS256',
            header: {},
        }
        this.access_token_expires = 0 // When < Date.now() it's time for a new one
    }
    // Update 'iat' for a time fresh request; used for the OAuth call specific to an IK
    _get_fresh_jwt(ctx) {
        const f = 'Docusign:_get_fresh_jwt'
        const now_secs = Math.floor(Date.now() / 1000)
        const payload = {
            aud: this.config.base_audience,
            scope: this.config.base_scopes,
            iss: this.config.send_ik,
            iat: now_secs,
            exp: now_secs + 3600,
        }
        const token = jwt.sign(payload, this.config.send_priv, this.sign_options)
        return token
    }
    // Smoke test
    decode(the_jwt) {
        return jwt.decode(the_jwt, { complete: true })
    }
    // To get an access token (good for 1 hr, no refresh_token, so redo this request each hour with updated iat value in JWT
    async _get_access_token(ctx) {
        const f = 'Docusign::_get_access_token'
        if (this.access_token_expires === true || this.access_token_expires > Date.now())
            return this.access_token_promise
        // Time to refresh (gaurd logic from multiple users)
        let resolve, reject
        this.access_token_expires = true
        const promise = (this.access_token_promise = new Promise((s, j) => {
            resolve = s
            reject = j
        }))

        const agent = this.make_agent(ctx)
        agent(this.config.base_oauth_endpoint, {
            method: 'POST',
            params: {
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: this._get_fresh_jwt(ctx),
            },
        })
            .then((result) => {
                // {"access_token":"...","token_type":"Bearer","expires_in":3600}
                this.access_token_expires = Date.now() + (result.data.expires_in - 10) * 1000
                resolve(result.data.access_token)
            })
            .catch((err) => {
                this.access_token_expires = 0 // Errors reset to 'try again'
                reject(err)
            })
        return this.access_token_promise
    }
    async _get_api_client(ctx) {
        const f = 'Docusign::_get_api_client: '
        const accessToken = await this._get_access_token(ctx) // Refreshes each hour
        ctx.log.debug(f, { accessToken })
        let dsApiClient = new docusign_esign.ApiClient()
        dsApiClient.setBasePath(this.config.base_account_uri)
        dsApiClient.addDefaultHeader('Authorization', 'Bearer ' + accessToken)
        return dsApiClient
    }
    // Create an 'envelope' (i.e. add specific recipients) from a 'template' (created in the wizard)
    // TODO SOLVE SENDING THE CHILD NAME INTO THE TEMPLATE - LIKE AS CUSTOM FIELD?  (I.E. CONSIDER IF WE CAN INJECT THE PARTICIPANT NAME INTO THE SUBJECT LINE PER IRB)
    // TODO ADD PID TO A HIDDEN CUSTOM FIELD
    _make_envelope(ctx, template_id, template_values, subject_line, signer_1, signer_2) {
        const f = 'Docusign::_make_envelope: '

        // Create template "role" elements to connect the signer and co-signer recipients to the template
        // We're setting the parameters via the object creation
        let role_1 = docusign_esign.TemplateRole.constructFromObject(signer_1)
        let role_2 = docusign_esign.TemplateRole.constructFromObject(signer_2)

        // create the envelope definition
        let env = new docusign_esign.EnvelopeDefinition()
        env.templateId = template_id
        env.templateRoles = [role_1, role_2]
        env.customFields = template_values // i.e. textCustomFields:[{name: 'ParticipantID', value: 'whatever'}]
        env.status = 'sent' // We want the envelope to be sent
        if (subject_line) env.emailSubject = subject_line

        return env
    }
    async send_envelope(ctx, template_id, template_values, subject_line, signer_1, signer_2) {
        const f = 'Docusign::send_envelope'
        ctx.log.debug(f, { template_id, template_values, signer_1, signer_2 })

        const dsApiClient = await this._get_api_client(ctx)
        let envelopesApi = new docusign_esign.EnvelopesApi(dsApiClient)
        let envelope = this._make_envelope(
            ctx,
            template_id,
            template_values,
            subject_line,
            signer_1,
            signer_2
        )
        let results = await envelopesApi.createEnvelope(this.config.base_account_id, {
            envelopeDefinition: envelope,
        })
        return results
    }
    async void_envelope(ctx, envelope_id, voided_reason) {
        const f = 'Docusign::void_envelope'
        ctx.log.debug(f, { envelope_id, voided_reason })

        const dsApiClient = await this._get_api_client(ctx)
        let envelopesApi = new docusign_esign.EnvelopesApi(dsApiClient)
        const envelope = {
            status: 'voided',
            voidedReason: voided_reason,
        }
        try {
            let results = await envelopesApi.update(this.config.base_account_id, envelope_id, {
                envelope,
            })
            return results
        } catch (err) {
            return err.response.body
        }
    }
    // results.formData is [ { name: 'Choose: Completing additional surveys', value: 'YES' }... ]
    async get_form_data(ctx, envelope_id) {
        const f = 'Docusign::get_form_data'
        const dsApiClient = await this._get_api_client(ctx)
        let envelopesApi = new docusign_esign.EnvelopesApi(dsApiClient)
        let results = await envelopesApi.getFormData(this.config.base_account_id, envelope_id)
        return results
    }
    setHookCallback(ctx, callback) {
        this.hookCallback = callback
    }
    // TODO Figure out what is in the request and get the results back to the 'domain' side
    async hookInbound(ctx, inbound_data) {
        const f = 'Docusign::hookInbound'
        // TODO WHAT IF THE DOMAIN SIDE NEVER HOOKED UP?
        if (this.hookCallback) {
            const results = this.hookCallback(ctx, inbound_data)
            return results
        }
        return false
    }
}
exports.Docusign = Docusign
