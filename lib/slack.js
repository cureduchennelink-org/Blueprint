const { IncomingWebhook } = require("@slack/webhook");

class Slack {
	static deps() {
		return { services:[ 'config', ]};
	}
	constructor(kit) {
		this.resource = "Slack";
		this.log = kit.services.logger.log;
		this.config = kit.services.config;
	}

	async getWebhook( ctx, webhookUrl) {
        const f = `${this.resource}::send:`
		ctx.log.debug( f, {webhookUrl});
		const webhook= await new IncomingWebhook( webhookUrl);
		ctx.log.debug( f, {webhook});
		return webhook;
	}

	async send( ctx, webhook, text) {
        const f = `${this.resource}::send`
		ctx.log.debug( f, {webhook, text});
        try {
            await webhook.send({ text });
        } catch (e) {
            ctx.log.error( f, e)
            return false;
        }
		return true;
	}
}
exports.Slack = Slack;
