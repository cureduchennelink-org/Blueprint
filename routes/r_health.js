//
// Health routes (and basic logs info)
//
// Note, these are protected endpoints; you need an auth_token=* with a valid role
//
// TODO BACK PORT TO MONGO - I'VE ONLY DONE A PSQL VERSION HERE, WITH A HIGHLY MODIFED CONCEPT OF MOVING QUERIES TO THE DB SERVICE LAYER
const Promise= require( 'bluebird');
const _= require( 'lodash');
const moment= require( 'moment');
const {jsonReplacer, exposeErrorProperties}= require( './json');

const SERVICE_NAME= process.env.npm_package_name || "blueprint";

class HealthCheck{
	static deps(){ return { psql:[ 'lamd', ], services:[ 'error', 'logger', 'ses', 'config', ], config:'TODO', }; }
	constructor(kit){
		this.E= kit.services.error;
		this.log= kit.services.logger.log;
		this.ses= kit.services.ses;
		this.sdb= kit.services.db.psql;
		this.ses_email_config= kit.services.config.ses.emails;
		this.config= kit.services.config;
		// ServiceHealth
		this.all_services= kit.services
		this.services= {}; // Will be populated with list of services that implement a health-check method
		if (this.config.health.db=== 'mongo') this.ObjectId= require( 'mongodb').ObjectId;

		this.endpoints={
			pingAuth:{
				verb: 'get', route: '/PingAuth',
				use: true, wrap: 'default_wrap', version:{ any: this._GetPing.bind( this)},
				sql_conn: false, auth_required: true,
			},
			getPing:{
				verb: 'get', route: '/Ping', lamd: false,
				use: true, wrap: 'default_wrap', version:{ any: this._GetPing.bind( this)},
				sql_conn: false, auth_required: false,
			},
			getLogs:{
				verb: 'get', route: '/Logs', lamd: false, // HIPAA lamd:false could hide that someone has accessed the system
				use: true, wrap: 'default_wrap', version:{ any: this._GetLogs.bind( this)},
				sql_conn: true, auth_required: true, roles:[ 'Dev', 'DevOps', ], // sql_conn used for pingComprehensive which dips into services
			},
			getDebug:{
				verb: 'get', route: '/Debug/:req_uuid', lamd: false, // HIPAA lamd:false could hide that someone has accessed the system
				use: true, wrap: 'default_wrap', version:{ any: this._GetDebug.bind( this)},
				sql_conn: true, auth_required: true, roles:[ 'Dev', 'DevOps', ], // Note: PSQL version needs a sql_conn
			},
			getServiceHealth:{
				verb: 'get', route: '/ServiceHealth', lamd: false,
				use: true, wrap: 'default_wrap', version:{ any: this._ServiceHealth.bind( this)},
				sql_conn: true, auth_required: true, roles:[ 'Dev', 'DevOps', ],
			},
			getPingComprehensive:{ // Back-door security access to just ping-comprehensive report
				verb: 'get', route: '/Logs/pingComprehensive', lamd: false, // HIPAA lamd:false could hide that someone has accessed the system
				use: true, wrap: 'default_wrap', version:{ any: this._GetLogs_HCProxy.bind( this)},
				sql_conn: true, // sql_conn used for pingComprehensive which dips into services
			},
		};
	}

	server_init(){
		// ServiceHealth
		Object.keys( this.all_services).forEach( nm => {
			if( typeof this.all_services[ nm].HealthCheck=== 'function') this.services[ nm]= this.all_services[ nm];
		});
	}

	_GetPing(ctx, pre_loaded){
		const use_doc={
			params:{
				dummy: '{String}'
			},
			response:{
				success: '{Bool}'
			},
		};
		if (ctx=== 'use') return use_doc;
		const f= 'R_Health:_GetPing:'

		// Return back to the Client
		return {send: {success: true, id: 'P'+ process.pid, request_count: ctx.lamd.request_count, request_count_high: ctx.lamd.request_count_high, config:{ api: this.config.api}}};
	}

	// Same as GetLogs but forces type=pingComprehensive and checks URL based security
	_GetLogs_HCProxy(ctx, pre_loaded){
		const use_doc={
			params:{
				// Hidden param: secret: '{String}' provided in ENV setting HEALTH_SECURITY_KEYS=key1,key2,key3,fish_fry_tomorrow
				red: '{Number} - statusCode if in "red" condition (for pingComprehensive) else 200',
				yellow: '{Number} - statusCode if in "yellow" condition (for pingComprehensive) else 200',
			},
			response:{ success: '{Bool}'}
		};
		if (ctx=== 'use') return use_doc;
		const f= 'R_Health:_GetLogs_HCProxy:';
		const p= ctx.p;

		if (this.config.health.security_keys.indexOf( p.secret) === -1){
			if( p.ref) ctx.res.status( Number( p.red));
			return {send:{ success: true, final_disposition: 's'}};
		}

		p.type= 'pingComprehensive';
		return this._GetLogs( ctx, pre_loaded);
	}

	async _GetLogs(ctx, pre_loaded){
		const use_doc={
			params:{
				type: '{String}',
				filt: '{String} - report specific filter value',
				red: '{Number} - statusCode if in "red" condition (for pingComprehensive) else 200',
				yellow: '{Number} - statusCode if in "yellow" condition (for pingComprehensive) else 200',
				red_250ms: '{Number} Default 2 (500ms)',
				yellow_250ms: '{Number} Default red\'s value',
				endpoint_baselines: '{String} endpoint1,baseValue;endpoint2,baseValue2;jobName3,baseValue3,... using 250ms blocks for values',
				epoch_secs: '{Number} Default last-hour',
				last_secs: '{Number} Dafult uses epoch_secs',
				choices: '{any}',
				now: '{Date} to moment() e.g. 2020-06-22 08:30:00-06',
			},
			response:{ success: '{Bool}'}
		};
		if (ctx=== 'use') return use_doc;
		const f= 'R_Health:_GetLogs:';
		const p= ctx.p;
		const lamd_or_service_results = []

		// Allow user to simulate 'now' (Note Please do moment_now.clone() if you use mutation methods
		const moment_now= moment( p.now) // Undefined is the real now
		if (!( moment_now.isValid())) throw new this.E.InvalidArg( f+ 'now');

		const options={
			method: "find",
			query: {},
			note: 'no-note',
		};
		const email_results=[ "deadlocks", "dailyCounts", "dailyPerf", "daily500s", ] // THESE RECIEVE EMAILS
		const D1= 24* 60* 60
		const H1=  1* 60* 60

		// Get value for yellow (and for mongo filter initually)
		const perf_threshold_ms_yellow= 250* Number( p.yellow_250ms || p.red_250ms ||  2);
		if (!( perf_threshold_ms_yellow< 100* 60* 1000)){ // Basically checking for NaN or other bad things
			perf_threshold_ms_yellow= 500
		}

		// Get value for 'red'
		const perf_threshold_ms_red= 250* Number( p.red_250ms ||  2);
		if (!( perf_threshold_ms_red< 100* 60* 1000)){ // Basically checking for NaN or other bad things
			perf_threshold_ms_red= 500
		}

		const last_secs= Number( p.last_secs); // This goes back from right now
		const epoch_secs= Number( p.epoch_secs) || H1; // This goes back this many secs and then covers the 'epoch' of that many seconds

		const type_map={
			lastbad100:{
				subject: 'Last Bad Queries',
				query:[ 'q_lastbad100', ],
			},
			last100:{
				subject: 'Last Query',
				query:[ 'q_last100', ],
			},
			last100job:{
				subject: 'Last jobs with job_name exists',
				query:[ 'q_last100job', ],
			},
			last100jobwork:{
				subject: 'Last jobs with did_work ne false',
				query: [ 'q_last100jobwork', ],
			},
			deadlocks:{
				note: 'last hour',
				subject: 'API Deadlocks',
				query: [ 'q_deadlocks', moment_now, last_secs, epoch_secs, H1, ],
			},
			dailyPerf:{
				subject: 'Daily Performance Aggregations of API',
				type: 'dailyPerf',
				note: `duration > yellow ${perf_threshold_ms_yellow}ms / red ${perf_threshold_ms_red}ms`,
				query: [ 'q_dailyPerf', moment_now, last_secs, epoch_secs, D1, perf_threshold_ms_yellow, ],
			},
			dailyCounts:{
				subject: 'Daily Counts Aggregations of API',
				method: "aggregate",
				query: [ 'q_dailyCounts', moment_now, last_secs, epoch_secs, D1, ],
			},
			dailyErrors:{
				subject: 'Daily Errors (unexpected) Aggregations of API',
				method: "aggregate",
				query: [ 'q_dailyErrors', moment_now, last_secs, epoch_secs, 'epoch', ],
			},
			pingComprehensive:{
				subject: 'Ping Comprehensive (Errors, perf, deadlocks, services) Aggregations of API',
				multiple: [{
					type: 'Errors',
					subject: 'Errors (unexpected) Aggregations of API',
					method: "aggregate",
					query: [ 'q_dailyErrors', moment_now, last_secs, epoch_secs, 'epoch', ],
				},{
					type: 'Perf',
					subject: 'Hourly Performance Aggregations of API',
					method: "aggregate",
					note: `duration > ${perf_threshold_ms_yellow}ms`,
					query:[ 'q_dailyPerf', moment_now, last_secs, epoch_secs, 'epoch', perf_threshold_ms_yellow],
				},{
					type: 'Deadlocks',
					subject: 'API Deadlocks',
					query: [ 'q_deadlocks', moment_now, last_secs, epoch_secs, 'epoch'],
				},{
					type: 'serviceRunQueue',
					subject: 'Service health: RunQueue',
					method: "service",
					service: 'RunQueue',
					email_if: 'r', // TODO USE THIS?
				}],
			},
		};

		if ( type_map[ p.type ]== null){
			throw new this.E.MissingArg( `Bad Health Type (options: ${Object.keys( type_map)}) - using: ${p.type}`);
		}

		let work_list;
		const report= type_map[ p.type]
		if (report.multiple!= null)
			work_list= report.multiple;
		else
			work_list= [ report];

		let all_results= [];
		let final_disposition= 'g'; // Default green, can move to yellow and red. Caller should indicate if non-200 for these statuses
		const start_all= Date.now();
		// Closure values for crossing .then blocks
		let start= false;
		let do_email= false;

		// Prep for looknig at threshold values
		const yellow_250ms= perf_threshold_ms_yellow/ 250;
		const red_250ms= perf_threshold_ms_red/ 250;
		const adj_by_endpoint= {};
		(p.endpoint_baselines || '').split( ';').forEach( nm_val => {
			if( !nm_val.length) return;
			const [nm, val]= nm_val.split( ',');
			adj_by_endpoint[ nm]= Number( val);
		});

		ctx.log.debug( f, {services_keys: Object.keys( this.services)});
		const doing_work= async work =>{
			const choices= Object.assign( {}, options, work); // TODO 9 THREE PARAMS OK? WAS _.merge
			ctx.log.debug( f+ 'doing_work', {choices});
			let db_results;
			// TODO if p.filt switch p.type when 'last100jobwork' choices.query[ "result.filter.contest.id"]= Number p.filt // NOW ids AND IS AN ARRAY

			start= Date.now();
			if (choices.method=== 'service'){
				if (!this.services[ choices.service]){
					db_results= { error: 'Service is not loaded: '+ choices.service};
				} else {
					db_results= await this.services[ choices.service].HealthCheck( ctx);
				}
			} else {
				db_results= await this.sdb.lamd[ choices.query[ 0]]( ctx, ...choices.query.slice( 1));
			}

			const lamd_or_service_results = db_results

			// Handle final-disposition based on results
			const next={ g_g: 'g', g_y: 'y', g_r: 'r', y_g: 'y', y_y: 'y', y_r: 'r', r_g: 'r', r_y: 'r', r_r: 'r'};
			if (choices.method=== 'service'){
				final_disposition= next[ `${final_disposition}_${lamd_or_service_results.status}`] || 'r';
			} else if ([ 'Perf', 'dailyPerf', ].indexOf( choices.type)> -1){
				// For LAMD results, adjust using per-endpoint baseline thresholds; look for red vs yellow vs not really any issue (is green) even if results
				lamd_or_service_results.forEach( entry=>{
					const rec= entry; // ._id; // TODO 9 I THINK PSQL'S _id IS THE WHOLE ROW
					// DEBUG rec.adj_key= rec.job_name ?( rec.verb+ rec.route)
					const adj= adj_by_endpoint[ rec.job_name || ( rec.verb+ rec.route)];
					let duration_adj;
					if (adj!= null) {
						rec.duration_adj= duration_adj= rec.duration_250- adj;
					} else duration_adj= rec.duration_250;
					if (duration_adj> red_250ms){
						rec.di= 'r';
						final_disposition= next[ `${final_disposition}_r`] || 'r';
					} else if (duration_adj> yellow_250ms){
						rec.di= 'y';
						final_disposition= next[ `${final_disposition}_y`] || 'y';
					}
				});
			} else {
				// Not a service (i.e. is a LAMD report) and not a performance report
				if (lamd_or_service_results.length !== 0){
					final_disposition= next[ `${final_disposition}_r`] || 'r'
				}
			}

			do_email=( choices.method !== 'service' && lamd_or_service_results.length > 0  && email_results.indexOf( p.type) > -1);

			if (0&& do_email!= false){ // TODO
				const recipient= { reason: choices.subject, type: choices.type, eml: this.ses_email_config.alert.To, note: choices.note, }
				const epicmvc_tables={
					Details: [ { msg: JSON.stringify(lamd_or_service_results, null, 2) } ],
					Recipient: [ recipient ],
					System:[ this.config.system],
					Subject: choices.subject,
				};
				await this.ses.send( ctx, 'alert', epicmvc_tables);
			}

			const send={
				success: true, note: choices.note, subject: choices.subject, date: new Date(),
				num_results: lamd_or_service_results.length, results: lamd_or_service_results,
				time_ms: Date.now()- start, // At least give *caller* the time per-request to diagnose timing issues
				do_email: do_email,
			};

			if (p.choices!= null) Object.assign( send, {choices, adj_by_endpoint});
			return send; // TODO 9 or {send} ?
		};

		try {
			for (const work of work_list){
				all_results.push( await doing_work( work)); // Array of promises
			}
		} catch (e) {
			// TODO e.message+= ' (choices:) '+ JSON.stringify( choices); // Note, choices has keys with '$' which cannot be serialized by MongoDB
			ctx.log.debug( f+ 'WORK_LIST', JSON.parse( JSON.stringify( e, jsonReplacer(true))));
			all_results= e; // Need to throw this, outside of this promise
		}

		//await Promise.all( all_result_promises)
		//.then( results=> all_results= results)
		//.catch( e=>{
			// TODO e.message+= ' (choices:) '+ JSON.stringify( choices); // Note, choices has keys with '$' which cannot be serialized by MongoDB
			//ctx.log.debug( f+ 'WORK_LIST', JSON.parse( JSON.stringify( e, jsonReplacer(true))));
			//all_results= e; // Need to throw this, outside of this promise
		//});
		if (all_results instanceof Error) throw this.E.ServerError( 'WORK_LIST', all_results.message);

		let send;
		if (all_results.length=== 1){
			send= all_results[ 0];
			send.now= moment_now.format()
			send.final_disposition= final_disposition;
		} else {
			if (p.red    && final_disposition=== 'r') ctx.res.status( Number( p.red));
			if (p.yellow && final_disposition=== 'y') ctx.res.status( Number( p.yellow));
			send={
				subject: report.subject,
				final_disposition: final_disposition,
				date: moment().format(),
				now: moment_now.format(),
				time_ms: Date.now()- start_all,
				results: all_results,
			}
		}
		return {send};
	}

	async _GetDebug(ctx, pre_loaded){
		const use_doc={
			params:{
				device: '{String}-FUTURE',
			},
			response:{
				success: '{Bool}',
				debug: '{Array}',
			},
		};
		if (ctx=== 'use') return use_doc;
		const f= 'Health:_GetDebug:';
		const p= ctx.p;
		const send={ success: true, debug: []};
		let db_results;
		const len= p.req_uuid && p.req_uuid.length; // TODO 9 SAME SYNTAX?
		if (!( len > 35)) throw new this.E.InvalidArg( 'req_uuid:'+ len+ 'L');

		db_results= await this.sdb.lamd.getDebug( ctx, p.req_uuid);
		send.debug= db_results

		return {send}
	}

	async _ServiceHealth(ctx, pre_loaded){
		const use_doc={
			params:{
				any: '{ANY} - reflected back in params:',
				service: '{String} - optional service name e.g. RunQueue to query for health-check',
				red: '{Number} - optional, status code when service is "red"',
				yellow: '{Number} - optional, status code when service is "yellow"',
			},
			response:{ success: '{Bool}', params: '{Ojbect}', health: '{Object}'},
		};
		if (ctx=== 'use') return use_doc;
		const f= 'Health:_ServiceHealth:'
		const p= ctx.p
		const send={ success: true, service_name: SERVICE_NAME, params: p, service: false, services: Object.keys( this.services)};

		if (this.services[ p.service]) {

			const result= await this.services[ p.service].HealthCheck( ctx);
			if (p.red && result.status=== 'r') {
				ctx.res.status( Number( p.red));
			}
			if (p.yellow && result.status=== 'y') {
				ctx.res.status (Number( p.yellow));
			}
			send.result= result;
		}
		return {send}
	}

}
exports.HealthCheck= HealthCheck
