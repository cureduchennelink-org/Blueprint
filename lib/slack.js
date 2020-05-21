const { IncomingWebhook } = require("@slack/webhook");

class Slack {
	static initClass() {
		this.deps = {};
	}
	constructor(kit) {
		this.resource = "Slack";
		this.f = `${this.resource}::constructor`;
		this.log = kit.services.logger.log;
		this.config = kit.services.config;

		const webhookUrl = this.config.slack.url;
		const slackOn = this.config.slack.on;
		if (!webhookUrl) {
			this.log.error(`${this.f}::MISSING SLACK URL, NOT TURNING ON.`);
			return;
		}

		if (!slackOn) {
			this.log.info(`${this.f}::SLACK SET TO OFF, NOT TURNING ON.`);
            return;
        }

		this.webhook = new IncomingWebhook(webhookUrl);
	}

	async send(message) {
        if (!this.webhook) return;
        const f = `${this.resource}::send`
        try {
            await this.webhook.send({ message });
        } catch (e) {
            this.log.error(`${f}::SLACK FAILED TO SEND`, { e })
            return false;
        }
	}
}
Slack.initClass();
exports.Slack = Slack;
