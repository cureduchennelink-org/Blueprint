//
// PostgreSQL LAMD
//

class PSqlLamd {

	constructor(core, kit) {
		this.E = kit.services.error
		this.resource = 'PSqlLamd'
		this.db = core
		this.table = 'lamd'
		this.table_deep = 'lamd_deep'
		const commonCols= {statusCode: 1, date: 1, route: 1, verb: 1, duration: 1, auth_id: 1, role: 1, err: 3, req_uuid: 1}
		this.schema = {
			q_lastbad100:     {...commonCols},
			q_last100:        {...commonCols},
			q_deadlocks:      {...commonCols, start: 1, },

			q_last100job:     {result: 1, date: 1, job_name: 1, err: 3, req_uuid: 1},
			q_last100jobwork: {result: 1, date: 1, job_name: 1, err: 3, req_uuid:  1, did_work: 1, },

			q_dailyPerf:      {route: 1, verb: 1, job_name: 1},
			q_dailyCounts:    {
				statusCode: 1, route: 1, verb: 1, // Endpoints,
				job_name: 1, did_work: 1, // RunQueue
				name: 4, code: 4, message: 4, // Errors
			},
			q_dailyErrors:    {
				statusCode: 1, route: 1, verb: 1, // Endpoints,
				job_name: 1, did_work:  1, // RunQueue
				name: 4, code: 4, message: 4, // Errors
			},
		};

	this.db.method_factory(this, 'PSqlLamd');
	}

	async write_many(ctx, rows) {
		const f= 'PSqlLamd:write_many:'
		//ctx.log.debug(f, {rows})

	// Using $1 because our generic mysql-to-psql thinks any args element as array matches 'IN (?)'
		const sql= `
			INSERT INTO ${this.table} (log)
			SELECT UNNEST( $1::jsonb[])
		`;
		return await this.db.sqlQuery( ctx, sql, [ rows])
	}

	async write_deep(ctx, row) {
		const f= 'PSqlLamd:write_deep_many:'
		//ctx.log.debug(f, {row})

	// Using $1 because our generic mysql-to-psql thinks any args element as array matches 'IN (?)'
		const sql= `
			INSERT INTO ${this.table_deep} (log)
			VALUES ($1)
		`;
		return await this.db.sqlQuery( ctx, sql, [ row])
	}

	// Moment_now can be simulated
	_time_query( ctx,  moment_now, last_secs, epoch_secs, duration_secs){
		const f= 'PSqlLamd:_time_query:'
		ctx.log.debug( f, {moment_now, last_secs, epoch_secs, duration_secs});

		if (duration_secs=== 'epoch' && last_secs< 32* 24* 60* 60){ // Max 1 month; If NaN, is false
			const last_end= moment_now.unix();
			const last_start= last_end- last_secs;
			return `(log->>'start')::bigint>= ${last_start* 1000} AND (log->>'start')::bigint <= ${last_end* 1000}`;
		}

		// Note: if epoch_secs is more than a month or is NaN, then logic will drop to the next 'if' so epoch defaults to 1 hour
		if (duration_secs=== 'epoch' && epoch_secs< 32* 24* 60* 60){ // Max 1 month; If NaN, is false
			const last_epoch_start= epoch_secs* Math.floor( moment_now.clone().subtract( epoch_secs, 's').unix()/ epoch_secs);
			const last_epoch_end= last_epoch_start+ epoch_secs- 1;
			return `(log->>'start')::bigint>= ${last_epoch_start* 1000} AND (log->>'start')::bigint <= ${last_epoch_end* 1000}`;
		}

		if ([ 'last-hour', 'epoch', ].indexOf( duration_secs)> -1){ // Is default for epoch
			const last_hour_start= moment_now.clone().subtract( 1, 'h').startOf('hour').valueOf();
			const last_hour_end= moment_now.clone().subtract( 1, 'h').endOf('hour').valueOf();
			return `(log->>'start')::bigint>= ${last_hour_start} AND (log->>'start')::bigint<= ${last_hour_end}`;
		}

		return `(log->>'start')::bigint>= ${moment_now.clone().subtract( duration_secs, 's').valueOf()}`;
	}

	// Extend projection to log->>'s
	_projection_query( projection){
		const sql_projection= [];
		if (Object.keys( projection).length=== 0) projection= {id: 2, log: 2} // Show all
		Object.keys( projection).forEach( (key)=>{
			if (projection[ key]=== 1) sql_projection.push( `log->>'${key}' as ${key}`);
			if (projection[ key]=== 2) sql_projection.push( key);
			if (projection[ key]=== 3) sql_projection.push( `log->'${key}' as ${key}`);
			if (projection[ key]=== 4) sql_projection.push( `log->'err'->>'${key}' as err_${key}`);
		});
		return sql_projection.join( ', ');
	}
	async q_lastbad100( ctx, limit=100){

		const sql=`
			SELECT ${this._projection_query( this.schema.q_lastbad100)}
			FROM ${this.table}
			WHERE (log->>'statusCode')::integer > 200 OR log ? 'err'
			ORDER BY id DESC
			LIMIT $1
		`;
		return await this.db.sqlQuery( ctx, sql, [ limit, ], true)
	}
	async q_last100( ctx, limit=100){

		const sql=`
			SELECT ${this._projection_query( this.schema.q_last100)}
			FROM ${this.table}
			WHERE NOT log ? 'job_name'
			ORDER BY id DESC
			LIMIT $1
		`;
		return await this.db.sqlQuery( ctx, sql, [ limit, ], true)
	}
	async q_last100job( ctx, limit=100){

		const sql=`
			SELECT ${this._projection_query( this.schema.q_last100job)}
			FROM ${this.table}
			WHERE log ? 'job_name'
			ORDER BY id DESC
			LIMIT $1
		`;
		return await this.db.sqlQuery( ctx, sql, [ limit, ], true)
	}
	async q_last100jobwork( ctx, limit=100){

		const sql=`
			SELECT ${this._projection_query( this.schema.q_last100jobwork)}
			FROM ${this.table}
			WHERE log ? 'job_name' AND log->>'did_work' != 'false'
			ORDER BY id DESC
			LIMIT $1
		`;
		return await this.db.sqlQuery( ctx, sql, [ limit, ], true)
	}
	async q_deadlocks( ctx, moment_now, last_secs, epoch_secs, time_window, limit=100){

		const sql=`
			SELECT ${this._projection_query( this.schema.q_deadlocks)}
			FROM ${this.table}
			WHERE log->'err'->>'code' = 'ER_LOCK_DEADLOCK' AND ${this._time_query( ctx, moment_now, last_secs, epoch_secs, time_window)}
			ORDER BY id DESC
			LIMIT $1
		`;
		return await this.db.sqlQuery( ctx, sql, [ limit, ], true)
	}
	async q_dailyPerf( ctx, moment_now, last_secs, epoch_secs, time_window, perf_threshold){

		const sql=`
			SELECT count(*) as count, ${this._projection_query( this.schema.q_dailyPerf)} ,TRUNC( (log->>'duration')::integer/ 250) as duration_250
			FROM ${this.table}
			WHERE ${this._time_query( ctx, moment_now, last_secs, epoch_secs, time_window)} AND (log->>'duration')::integer> ${perf_threshold}
			GROUP BY route, verb, job_name, duration_250
			ORDER BY duration_250 DESC
		`;
		return await this.db.sqlQuery( ctx, sql, [], true)
	}
	async q_dailyCounts( ctx, moment_now, last_secs, epoch_secs, time_window){

		const sql=`
			SELECT count(*) as count, ${this._projection_query( this.schema.q_dailyCounts)}
			FROM ${this.table}
			WHERE ${this._time_query( ctx, moment_now, last_secs, epoch_secs, time_window)} AND (log->>'statusCode')::integer != 406
			GROUP BY statusCode, route, verb, job_name, did_work, err_name, err_code, err_message
			ORDER BY count DESC
		`;
		return await this.db.sqlQuery( ctx, sql, [ ], true)
	}
	async q_dailyErrors( ctx, moment_now, last_secs, epoch_secs, time_window){

		// TODO NEED TO HANDLE SPECIAL CASE OF did_work IS NULL MAYBE?
		// TODO AND NOT( log->>'did_work' = ANY(ARRAY[ 'add-job', 'false', 'true' ]))
		const sql=`
			SELECT count(*) as count, ${this._projection_query( this.schema.q_dailyErrors)}
			FROM ${this.table}
			WHERE
				${this._time_query( ctx, moment_now, last_secs, epoch_secs, time_window)}
				AND NOT( (log->>'statusCode')::integer = ANY(ARRAY[ 200, 400, 401, 403, 404 ]))
			GROUP BY statusCode, route, verb, job_name, did_work, err_name, err_code, err_message
			ORDER BY count DESC
		`;
		return await this.db.sqlQuery( ctx, sql, [ ], true)
	}

	async getDebug(ctx, req_uuid){

		const sql= `
			SELECT id, log
			FROM ${this.table_deep}
			WHERE log->>'req_uuid' = ?
		`;
		return await this.db.sqlQuery( ctx, sql, [ req_uuid]);
	}

};
exports.PSqlLamd = PSqlLamd
