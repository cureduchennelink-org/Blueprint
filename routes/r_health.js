/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Promise= require('bluebird');

const {ObjectId} = require('mongodb');
const SERVICE_NAME= process.env.npm_package_name || "blueprint";

class HealthCheck {
	static initClass() {
		this.deps= {services:[ 'logger', 'error', 'ses', 'lamd']};
	}
	constructor(kit){
		this._ServiceHealth = this._ServiceHealth.bind(this);
		this._GetDebug = this._GetDebug.bind(this);
		this._GetLogs = this._GetLogs.bind(this);
		this._GetPing = this._GetPing.bind(this);
		this.E= kit.services.error;
		this.log= kit.services.logger.log;
		this.lamd= kit.services.lamd;
		this.ses= kit.services.ses;
		this.ses_email_config= kit.services.config.ses.emails;
		this.config= kit.services.config;
		// ServiceHealth
		this.all_services= kit.services;
		this.services= {}; // Populate with list of services that implement a health-check method

		// Lead Endpoints
		this.endpoints= {
			getLogs: {
				verb: 'get', route: '/Logs',
				use: true, wrap: 'default_wrap', version: { any: this._GetLogs
			},
				sql_conn: false, auth_required: false
			},
			pingAuth: {
				verb: 'get', route: '/PingAuth',
				use: true, wrap: 'default_wrap', version: { any: this._GetPing
			},
				sql_conn: false, auth_required: true
			},
			getPing: {
				verb: 'get', route: '/Ping',
				use: true, wrap: 'default_wrap', version: { any: this._GetPing
			},
				sql_conn: false, auth_required: false
			},
			getDebug: {
				verb: 'get', route: '/Debug/:req_uuid', lamd: false,
				use: true, wrap: 'default_wrap', version: { any: this._GetDebug
			},
				sql_conn: false, auth_required: false
			},
			getHealth: {
				verb: 'get', route: '/Health', lamd: false,
				use: true, wrap: 'default_wrap', version: { any: this._ServiceHealth
			},
				sql_conn: true, auth_required: false
			}
		};
	}

	server_init() {
		// ServiceHealth
		return (() => {
			const result = [];
			for (let nm in this.all_services) {
				if (typeof this.all_services[ nm].HealthCheck === 'function') {
					result.push(this.services[ nm]= this.all_services[ nm]);
				}
			}
			return result;
		})();
	}

	_ServiceHealth(ctx, pre_loaded){
		const use_doc= {
			params: {
				any: '{ANY} - reflected back in params:',
				service: '{String} - optional service name e.g. RunQueue to query for health-check',
				red: '{Number} - optional, status code when service is "red"',
				yellow: '{Number} - optional, status code when service is "yellow"'
			},
			response: { success: '{Bool}', params: '{Ojbect}', health: '{Object}'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'R_Status:_Get:';
		const {
            p
        } = ctx;
		const send= {success: false, service_name: SERVICE_NAME, params: p, service: false, services: (((() => {
			const result = [];
			for (let nm in this.services) {
				result.push(nm);
			}
			return result;
		})()))};

		return Promise.resolve().bind(this)
		.then(function() {
			if (!(p.service in this.services)) { return false; }

			return this.services[ p.service].HealthCheck(ctx);}).then(function(result){
			if (result !== false) {
				if (result !== false) { send.service= result; }
				if ((p.red != null) && ((result != null ? result.status : undefined) === 'r')) { ctx.res.status(Number(p.red)); }
				if ((p.yellow != null) && ((result != null ? result.status : undefined) === 'y')) { ctx.res.status(Number(p.yellow)); }
			}

			// Return back to the Client
			send.success= true;
			return {send};});
	}

	_GetDebug(ctx, pre_loaded){
		const use_doc= {
			params: {
				device: '{String}-FUTURE'
			},
			response: {
				success: '{Bool}',
				debug: '{Array}'
			}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'R_Debug:_Get:';
		const {
            p
        } = ctx;
		const send= {success: true, debug: []};
		const len= p.req_uuid != null ? p.req_uuid.length : undefined;
		if (!(len > 35)) { throw new this.E.InvalidArg('req_uuid:'+ len+ 'L'); }

		return Promise.resolve().bind(this)
		.then(function() {

			const method= 'find';
			const query= { "_id": p.req_uuid};
			const projection= {}; // {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1}
			const options = {};
			const hint= {};
			const sort= {}; // { $natural:-1 }
			return this.lamd.read_deep(ctx, method, query, projection, options, hint, sort);}).then(function(db_results) {
			send.debug= db_results;

			return {send};});
	}

	_GetLogs(ctx, pre_loaded){
		const use_doc= {
			params: {
				type: '{String}',
				filt: '{String} - report specific filter value'
			},
			response: { success: '{Bool}'
		}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'R_Health:_Get:';
		const {
            p
        } = ctx;
		let success= false;
		let lamd_results = [];

		let method = "find";
		let query = {};
		let projection = {};
		let options = {};
		let hint= {};
		let sort= {};
		const type_map = {
			lastbad100: {
				subject: 'Last Bad Queries',
				query: { "statusCode": { $ne: 200 }},
				projection: {"_id": 0, "statusCode":1, "date":1, "route":1,"verb":1,"err":1,"req_uuid":1},
				sort: { $natural:-1 }
			},
			last100: {
				subject: 'Last Query',
				query: {},
				projection: {"_id": 0, "statusCode":1, "date":1, "job_name":1, "result.did_work":1, "route":1,"verb":1,"err":1,"req_uuid":1},
				sort: { $natural:-1 }
			},
			last100jobwork: {
				subject: 'Last jobs with result.did_work true',
				query: {"result.did_work": true},
				projection: {"_id": 0, "result":1, "date":1, "job_name":1, "err":1,"req_uuid":1},
				sort: { $natural:-1 }
			},
			deadlocks: {
				subject: 'API Deadlocks',
				query: {"_id": {"$gt": new ObjectId( Math.floor(new Date(new Date()-(1000*60*60)).getTime()/1000).toString(16) + "0000000000000000")},"err.code" : "ER_LOCK_DEADLOCK"},
				projection: {"_id": 0, "statusCode":1, "start":1, "route":1,"verb":1,"err":1,"req_uuid":1},
				hint: {"err.code":1}
			},
			daily: {
				subject: 'Daily Aggregations API',
				query: [{$match:{"_id": {$gt:new ObjectId( Math.floor(new Date(new Date()-(1000*60*60*24)).getTime()/1000).toString(16) + "0000000000000000" )}, "statusCode":{"$ne":406}}},{ "$group": {"_id": { "statusCode":"$statusCode", "route": "$route", "err": "$err.proxy_error", "err_code": "$err" }, "count":{ "$sum": 1 }}}, {$sort:{"count":-1}}],
				method: "aggregate"
			}
		};

		if (!(p.type in type_map)) { throw new this.E.MissingArg(`Bad Health Type (options: ${(() => {
			const result = [];
			for (let nm in type_map) {
				result.push(nm);
			}
			return result;
		})()}) - using: ${p.type}`); }

		const {
            subject
        } = type_map[p.type];
		method= type_map[p.type].method != null ? type_map[p.type].method : method;
		({
            query
        } = type_map[p.type]);
		projection= type_map[p.type].projection != null ? type_map[p.type].projection : projection;
		options= type_map[p.type].options != null ? type_map[p.type].options : options;
		hint= type_map[p.type].hint != null ? type_map[p.type].hint : hint;
		sort= type_map[p.type].sort != null ? type_map[p.type].sort : sort;
		if (p.filt) {
			switch (p.type) {
				case 'last100jobwork':
					query[ "result.filter.contest.id"]= Number(p.filt);
					break;
			}
		}

		return Promise.resolve().bind(this)
		.then(function() {

			return this.lamd.read(ctx, method, query, projection, options, hint, sort);}).then(function(db_results) {
			lamd_results = db_results;

			const email_results = ["deadlocks","deadlocks_backend","daily","daily_backend"];
			if (!(lamd_results.length > 0) || !(email_results.indexOf(p.type) > -1)) { return false; }
			const recipient= { reason: subject, type: p.type, eml: this.ses_email_config.alert.To };
			const epicmvc_tables= {
				Details: [ { msg: JSON.stringify(lamd_results, null, 2) } ],
				Recipient: [ recipient ]
			};
			return this.ses.send('alert', epicmvc_tables);}).then(function(){

			success= true;
			return {send: {success, num_results: lamd_results.length, results: lamd_results }};});
	}

	_GetPing(ctx, pre_loaded){
		const use_doc= {
			params: {
				dummy: '{String}'
			},
			response: {
				success: '{Bool}'
			}
		};
		if (ctx === 'use') { return use_doc; }
		const f= 'R_Health:_GetPing:';
		const {
            p
        } = ctx;
		let success= false;

		// Return back to the Client
		success= true;
		return {send: {success, request_count: ctx.lamd.request_count, request_count_high: ctx.lamd.request_count_high, config: {api: this.config.api}}};
	}
}
HealthCheck.initClass();

exports.HealthCheck= HealthCheck;
