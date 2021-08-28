//
// Route class DocusignWebhook - Inbound endpoint from DocuSign for each envelope status change
//
// Note:
//  - Caller should provide the configured BasicAuth user/pass
//
BasicAuthHeader = (user, pass) => 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')

class DocusignWebhook {
    static deps() {
        return {
            services: ['Docusign', 'config', 'samples', 'participant'],
            config: '{user,pass}',
        }
    }
    constructor(kit) {
        this.E = kit.services.error
        this.docusign = kit.services.Docusign
        this.tasks = kit.services.tasks
        this.resource = 'DocuSign'
        this.config = kit.services.config.docusign_webhook
        this.samples = kit.services.samples
        this.participant = kit.services.participant
        this.bcplatforms = kit.services.BCPlatforms
        this.expectedHeader = BasicAuthHeader(this.config.user, this.config.pass)

        this.endpoints = {
            postHookInbound: {
                // TODO Figure out which of these Docusign uses (post or get)
                verb: 'post',
                route: `/${this.resource}/webhook`,
                use: true,
                wrap: 'default_wrap',
                version: { any: this._hookInbound.bind(this) },
                sql_conn: true, // TODO CONSIDER IF THIS IS NEEDED ONCE WE ADD RUNQ VS. DOING IT ALL ON THIS ENDPOINT
                sql_tx: true, // TODO SEE ABOVE RUNQ
                auth_required: false, // Will manually check Basic auth
            },
            testParticipantEsign: {
                // This is for ease of localhost testing
                verb: 'post',
                route: `/${this.resource}/test_esign`,
                use: true,
                wrap: 'default_wrap',
                version: { any: this._testParticipantEsign.bind(this) },
                sql_conn: true,
                sql_tx: true,
                auth_required: true,
            },
        }
    }
    async _hookInbound(ctx) {
        const f = `${this.resource}:_hookInbound:`
        const use_doc = {
            params: {},
            response: { success: 'Boolean' },
        }
        if (ctx === 'use') return use_doc
        const send = { success: true }

        // Check BasicAuth using config value (Lets log it first, and confirm)
        const is_match = ctx.req.headers.authorization === this.expectedHeader
        ctx.log.debug(f, { is_match, expectedHeader: this.expectedHeader })
        if (!is_match) throw new this.E.BasicAuthError('DOCUSIGN_WEBHOOK')
        const res = await this.docusign.hookInbound(ctx, ctx.p)

        return { send }
    }
    //for localhost development only
    async _testParticipantEsign(ctx) {
        const f = `${this.resource}:_testParticipantEsign:`
        const use_doc = {
            params: {},
            response: { success: 'Boolean' },
        }
        if (ctx === 'use') return use_doc
        const { p } = ctx

        if (ctx.req.auth.token.role !== 'admin') {
            throw new this.E.AccessDenied('UNAUTHORIZED: ADMIN TRIGGER TEST ESIGN')
        }

        if (
            process.env.HOST !== 'localhost' &&
            process.env.HOST !== 'test-api.cureduchenne.deviq.io'
        ) {
            throw new this.E.ServerError(`Error: Test Only`)
        }
        const send = { success: true }

        const bcp_res = await this.bcplatforms.push_participant_id(ctx, p.participant_id, 'S_12')
        send.bcp = bcp_res
        await this.tasks.handleConsentEvent(
            ctx,
            p.event_name,
            'Localhost override',
            p.participant_id,
            'localhost'
        )

        return { send }
    }
}

exports.DocusignWebhook = DocusignWebhook
