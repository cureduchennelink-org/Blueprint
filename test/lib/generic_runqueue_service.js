// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise= require('bluebird');
const _= require('lodash');

class GenericService {
	static initClass() {
		this.deps= {services:[ 'config', 'error', ], config: ''};
	}
	constructor(kit) {
		this.Success = this.Success.bind(this);
		this.Repeat = this.Repeat.bind(this);
		this.Fail = this.Fail.bind(this);
		this.FailThenSucceed = this.FailThenSucceed.bind(this);
		const f= 'GenericService::constructor';
		this.log= 		kit.services.logger.log;
		this.E= 		kit.services.error;
		this.config=	kit.services.config.tropo;

		// Caller would use set query string with e.g. action=create
		/*
		@base_opts= _.merge
			json: true # request-promise package will parse the response for us
			url: @config.ApiUrl # To be appended to by caller
			headers: {}
		,@config.options
		*/
		this.log.debug(f, this);
	}

	// A successful service
	Success(job){
		const f= 'GenericService::Success:';
		const e= f;
		this.log.debug(f, {job});
		this.log.debug(f+'JSON', JSON.parse(job.json));
		return {success: true};
	}

	// A successful service, with repeat
	Repeat(job){
		const f= 'GenericService::Repeat:';
		const e= f;
		this.log.debug(f, {job});
		this.log.debug(f+'JSON', JSON.parse(job.json));
		return {success: true, replace: {json: job.json, run_at: [20, 's']}};
	}

	// A failing service
	Fail(job){
		const f= 'GenericService::Fail:';
		const e= f;
		this.log.debug(f, {job});
		this.log.debug(f+'JSON', JSON.parse(job.json));
		throw new Error('What a terrible failure');
	}

	// A service that fails on the first pass then succeeds
	FailThenSucceed(job){
		const f= 'GenericService::FailThenSucceed:';
		const e= f;
		this.log.debug(f, {job});
		this.log.debug(f+'JSON', JSON.parse(job.json));
		if (job.retries) {
			return {success: true};
		} else {
			throw new Error('What a terrible failure');
		}
	}
}
GenericService.initClass();

exports.GenericService= GenericService;
