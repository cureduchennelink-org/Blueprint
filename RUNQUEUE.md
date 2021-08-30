# Runqueue - Multi-server Job Scheduler and Runner
Work that is (or can be) done by our API servers but is not work caused by an endpoint request, falls into the category of "jobs." A job is implemented as a method of a service module. It can be reoccurring or run just once. If there is an error, it can be retried several times. When multiple API instances are running, the Runqueue service will ensure that a job does not get scheduled to run more than once at a time. The service also will typically spread work out across servers, and can group jobs for the purpose of limiting the number of in-flight jobs in a group.

### Pre-requisites
This tutorial assumes you have set up the DB (from [DATABASE_EXAMPLE.md](DATABASE_EXAMPLE.md)) and optionally LAMD (from [LAMD.md](LAMD.md)).

## Use cases
For re-occurring jobs, this system is designed for scheduling a job that runs at most every few seconds; it is not much granular than about every second. It also is designed to support many thousands of scheduled jobs in the queue, most of which run once, and many run each min or hour or longer apart. For example, if you have just onboarded a user, but they have not yet finished some part of their profile, and you wish to send them an email an hour from now if they have not yet completed it - you can add a job during onboarding to run one hour in the future. Then, you can either have that job check that it is still valid to send the email, and either send it or not, but then exit - or you can assign a unique_key to the job when you create it, and when they finish the profile task, you can just delete this job before it runs. For this job to know which user it was created for, you would set the `json` state value when you create this job.

## AddJob
To add a job to the queue, you call Runqueue.AddJob( ctx, details) - `ctx.conn` must be a usable DB handle; a transaction is not required. `Details` must have at least a `topic` which appears in the config file, and a `json` string for any state information being held for this job. Many jobs can be added under the same topic. More on topics is shown below - it is basically a set of attributes to help the Runqueue service know how to schedule, run, retry, fail, limit, etc. this job.

## Database backed job queue
The database is used to record jobs that are in the queue. It has a sort key to quickly find jobs that are ready to run next. Similar to a crontab entry, the DB has a timestamp for when to run a job next and an opaque `json` string for this job. Additional DB columns are used to track error states, an in-process flag, etc.

## Health check
The Runqueue service HealthCheck method is exposed via the `lib/r_health` endpoints. There are three checks made by this method: Delays, retries, and failures.
#### Delays
Jobs which have not yet been scheduled but have gone past the alarm_delay/warn_delay configured values; 
#### Retries
Jobs which have had to be retried but have gone past the alarm_cnt/warn_cnt configured values; 
#### Failures
These are jobs which have passed their fail_at datetime (assumed to be hung or the server died while in-process)

## Configuration
In the Blueprint.Node default configuration there are several sane default settings. Your config only needs to add where these are not desirable. You would create a `runqueue:` hash at the top level of your `src/container.js` config file, and at least define a `topics:` object for each of your job topics. The following is what is in Blueprint.Node default config which includes a few sample topics ...

	runqueue: {
		// Notes: the *_at takes a 'moment().add' spec [number,string]; string should be one of:
		// (months or M) (weeks or w) (days or d) (hours or h) (minutes or m) (seconds or s)
		settings: {
			poll_interval_ms: false, jobs: 100, read_depth: 20,
			pollLogDelay: {quantity: 5, measurement: 'm'} // Chasen added this feature
		},
		topic_defaults: {
			back_off: 'standard', last_fail: false, // No special handling
			priority: 1000, group_ref: 'NONE', limit: rq_max, // no reasonable limit
			alarm_cnt: 8, warn_cnt: 3, warn_delay: [3,'m'], alarm_delay: [10,'m'], fail_at: [5, 'm']
		},
		external_groups: {
			default: {	connections: rq_max, requests: [rq_max, rq_max, 'm'] }, // No limit on connections or req's-per-min
			SES:		{},
			SampleTest: {}
		},
		topics: {
            // YOUR ACTIVE TOPICS WILL MERGE IN HERE
        },
		SAMPLE_topics: {
			alert_ses: {
				service: 'IvyHealth.SesAlert', type: 'per-user',
				priority: 320, run_at: [1,'s'], group_ref: 'SES'
			},
		},
		DISABLED_topics: {
			email_daily_user: {
				service: 'Reports.Daily', type: 'per-user,reoccur',
				priority: 900, run_at: [1,'day'], group_ref: 'SES'
			},
			email_weekly_user: {
				service: 'Reports.Weekly', type: 'per-user,reoccur',
				priority: 950, run_at: [7,'day'], group_ref: 'SES'
			}
		}
	},

## Topics
A "topic" is a generic description of a job - kind of a "job type." It is a list of attributes common to all jobs of this type, where individual jobs can override some of these attribute values. There are also default attributes for all topics in `topic_defaults: {}` (see above.) An example of a daily email report might be ...

			email_daily_user: {
				service: 'Reports.Daily', type: 'per-user,reoccur',
				priority: 900, run_at: [1,'day'], group_ref: 'SES'
			},

##### service
This hash gives the "service name" (from kit.services[ name]) a dot and "method name." This is the method that will be called when jobs of this type are scheduled.

##### type
A string that is ignored; for human consumption. Is this a one-and-done or reoccurring? Let people know what one job represents

##### priority
Any number, which is going to be part of the sort-by when pulling jobs to start running them. Lower numbers are executed first

##### run_at
This can be a string date, or an array representing a relative value. It can occur here, but it can also be set by your logic when a job is being added to the DB.

##### group_ref
This is any string to "group" various jobs (from various topics) together, to address resource limitations. For example, if SES only allowed 10 simultaneous connections sending emails, you could group all email sending jobs with this string "SES" and in the group definition / configuration limit it to 10 jobs at a time. This value works across multiple servers.

### The following are defaulted to reasonable values, but can be changed per-topic if needed

##### back_off: 'standard'
A "strategy" for when to 'retry' after errors. The Runqueue service has defined 'standard' (exponential), 'year' (for testing), 'immediate' ([0,'s'])

##### limit: rq_max
Maximum in-flight jobs of this type
##### alarm_cnt: 8
Number of retries this job has reached where a 'red' status should be reported by the health-check endpoints.
Once this count has been reached, the job will stop being scheduled.
##### warn_cnt: 3
Number of retries this job has reached where a 'yellow' status should be reported by the health-check endpoints
##### warn_delay: [3,'m']
Amount of time this job has been waiting in the queue to run, where a 'yellow' status should be reported by the health-check endpoints
##### alarm_delay: [10,'m']
Amount of time this job has been waiting in the queue to run, where a 'red' status should be reported by the health-check endpoints
##### fail_at: [5, 'm']
How long a job can run before it is considered to have failed (possibly hung, or never returned) This timestamp can sometimes be exceeded if the server has crashed while the job was marked as in-process. It is only used to create a 'red' alarm in the health-check endpoints


## Sample service to play with
Let's create a service that exposes a method that can be used to run jobs in the Runqueue DB.
For more information on how service modules work, see [SERVICE_MODULES.md](SERVICE_MODULES.md)
Our sample service will be responsible for adding the job to the Runqueue, and then implementing the job via the method 'myJobMethod.' There are a few housekeeping things we will need to consider. (In the near future we will see how the 'wrapper' for Runqueue can make our life easier.)

### Use-case for our "job"
The use-case for this job is that we expect to be called a few times before we get all our work done. We can track our 'state' in the `json` object for our job. We also want to demonstrate how errors will cause us to be retried, and how we control being retried for more work without an error condition, and how to signal that we do not want to be scheduled anymore (i.e. the work is done.)

### The code
Place this code into a  new source module `src/myjob_service.js` ...

    //
    // MyJobService - sample service for blueprint documentation (includes a runqueue method / job)
    //
    // Sample config for this job:
    //  myjob: {
    //    service: 'MyJobService.myJobMethod', type: 'whatever you like here: do once and quit',
    //    unique_key: 'myjob', priority: 1000, run_at: [5,'s']
    //  }

    class MyJobService {
        static deps() {
            return { services: ['db', 'RunQueue'] }
        }
        constructor(kit) {
            this.sdb = kit.services.db.psql
            this.rq = kit.services.RunQueue
            this.counter = 100
        }
        async server_start(kit) {
            const ctx = {
                conn: await this.sdb.core.Acquire()
            }
            try {
                await this.rq.AddJob(ctx, { topic: 'myjob', json: JSON.stringify({ some: 'value', counter: this.counter }) })

            } catch(e) {
                console.log( '================ >> ', e)
                if (e.code=== '23505' && e.constraint=== 'ix_runqueue__unique_key') {} // PostgreSQL dup key error, this is ok with us, ignore it
                else throw e
            } finally {
                this.sdb.core.release(ctx.conn);
            }
        }
        myJobMethod(job) {
            const f = '============>> MyJobService:myJobMethod:' // Easy to find this line in the output
            console.log(f, job)
            const state = JSON.parse(job.json)
            // Throw an error to watch it retry
            if (state.counter === 101 && job.last_reason == null) throw new Error('I failed hard, pick again');

            // Do some legitimate work, and track how far along we are in the 'json' state
            state.counter = ++this.counter

            // When we have done everything...
            if (this.counter > 103) return { success: true } // We finished, don't call this job again

            // Record state for next round, choose a run_at that reschedules ourselves immediately, to finish the work
            const replace = { run_at: [0, 's'], json: JSON.stringify(state) }

            return { success: true, replace }
        }
    }

    exports.MyJobService = MyJobService


### src/container.js
We need to tell Blueprint.Node 2 more things - how to find our new service, and we need to define our 'topic' for the job we want to add - update `service_modules:` and add `runqueue:` to `src/container.js` ...

    runqueue: {
        topics: {
            myjob: {
                service: 'MyJobService.myJobMethod', type: 'whatever you like here: do once and quit',
                unique_key: 'myjob', priority: 1000, run_at: [5,'s']
            }
        }
    },
    route_modules: {
        ...
    },
    service_modules:{
        MyJobService: { class: 'MyJobService', file: 'src/myjob_service'}
    },


### src/app.js
Also, to load this new service and to include Runqueue's dependencies, add to 'services' RunQueue and MyJobService, also to psql_mods 'runqueue' - update `src/app.js` ...

    // Lists of modules to include on start-up
    const services = ['db', 'auth', 'lamd', 'RunQueue', 'MyJobService']
    const routes = ['FruitRoute', 'JunkRoute', 'Auth', 'Health', ]
    const psql_mods = ['junk', 'auth', 'token', 'lamd', 'runqueue']

### db/scripts/V1__base.psql
Runqueue service needs a table defined as well. Add this psql (from [db/schema_runqueue.psql](db/schema_runqueue.psql])) to the end of your `db/scripts/V1__base.psql` ...

    CREATE TABLE runqueue
    (
        id SERIAL     PRIMARY KEY
        , di SMALLINT   DEFAULT 0 NOT NULL /* disposal - 0:none,1:disabled,2:purge*/
        , cr TIMESTAMP  DEFAULT NOW()
        , mo TIMESTAMP  DEFAULT NOW()

        , unique_key    VARCHAR(255) DEFAULT NULL       /* Arbitrary; for job uniqueness/lookup.  Must be unique across topics/jobs or null */

        , topic         VARCHAR( 128) DEFAULT NULL      /* Which topic to inform to process this job */
        , group_ref     VARCHAR( 128) DEFAULT NULL      /* Which group for connection-limit counts */

        , in_process    SMALLINT DEFAULT 0 NOT NULL      /* 0:not-running,1:running*/
        , priority      INT DEFAULT 1000 NOT NULL        /* */
        , run_at        TIMESTAMP(0) DEFAULT NULL

        , retries       INT DEFAULT 0 NOT NULL
        , fail_at       TIMESTAMP(0) NULL DEFAULT NULL   /* When will we conclude caller has crashed */
        , last_reason   TEXT DEFAULT NULL                /* On app error, reason string for next run if needed */

        , json TEXT     DEFAULT NULL                     /* Caller's info, such as text-message, email-data */
    ) ;

    CREATE INDEX ix_runqueue__next_job ON runqueue(in_process,priority,run_at); /* Can be used to select just the one next job to do */
    CREATE UNIQUE INDEX ix_runqueue__unique_key ON runqueue(unique_key); /* For App to query specific jobs in the queue */

#### Reset your DB ...

    export SUPERUSER=`whoami`
    export DBHOST=localhost
    export DBNAME=local_yourapp_yourname
    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql

#### Run it ...

        node src/app.js | bunyan -o short

### Look for results
Looking at the MyJobService module code, the myJobMethod has a console.log line. Each time this job runs, we should get a line of output with the preceding string of equal signs `'============>> MyJobService:myJobMethod:`, and the `job` object. Here is what you should see ...

##### RunQueue service starting
The RunQueue service, on start up, looks for 'topics' and merges defaults in to each one, to create a list of working topics that Jobs can be created for. In our case, we have just the one topic with a 'nm' of 'myjob'. Notice that by default (if not changed when adding the job) it will wait 5 seconds from when the job is added, before scheduling the job to run ...

    [2021-08-30T14:25:17.221Z] DEBUG: server/25546 on host.local:
        RunQueue::server_start: {
            topic: {
                nm: 'myjob',
                back_off: 'standard',
                last_fail: false,
                priority: 1000,
                group_ref: 'NONE',
                limit: 1000000,
                alarm_cnt: 8,
                warn_cnt: 3,
                warn_delay: [ 3, 'm' ],
                alarm_delay: [ 10, 'm' ],
                fail_at: [ 5, 'm' ],
                service: 'MyJobService.myJobMethod',
                type: 'whatever you like here: do once and quit',
                unique_key: 'myjob',
                run_at: [ 5, 's' ]
            }
        }

##### AddJob called
When our MyJobService starts up, it adds a job using RunQueue.AddJob( ctx, details) and the RunQueue service writes this to the DB as an actual job to be run when the `run_at` timestamp expires ... 

    [2021-08-30T14:25:17.231Z] DEBUG: server/25546 on host.local: PostgreSqlCore:sqlQuery:-101-:PSQL:10
     INSERT INTO runqueue
      ( in_process,retries,fail_at,last_reason,priority,unique_key,topic,json,run_at,group_ref )
       VALUES ( $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 )
    
    [2021-08-30T14:25:17.231Z] DEBUG: server/25546 on host.local:
        PostgreSqlCore:sqlQuery:-101-:ARGS [
        0,
        0,
        null,
        null,
        1000,
        'myjob',
        'myjob',
        '{"some":"value","counter":100}',
        '2021-08-30 08:25:22',
        'NONE'
        ]
    
    [2021-08-30T14:25:17.234Z] DEBUG: server/25546 on host.local: PostgreSqlCore:sqlQuery:-101-:
     { command: 'INSERT', rowCount: 1, rows: [], time_ms: 3 }

##### RunQueue poller eventually finds a job
The RunQueue service has a polling process that checks the DB for jobs that are ready to run (run_at < current-time). Initially this will return  nothing until the 5 seconds have passed. Then we see below how the job is found and read from the DB. Many such jobs may be read from the DB at one time. Each API server instance then attempts to get a 'lock' on this job, to be the instance that runs the job (using optimistic locking) ...

    [2021-08-30T14:25:27.241Z] DEBUG: server/25546 on host.local:
        PostgreSqlCore:sqlQuery:-101-:PSQL:3 
                    SELECT *
                    FROM runqueue
                    WHERE run_at < $1
                    AND retries < $2
                    AND in_process = 0
                    AND di= 0
                    ORDER BY priority, run_at
                    LIMIT $3
                
    [2021-08-30T14:25:27.242Z] DEBUG: server/25546 on host.local:
     PostgreSqlCore:sqlQuery:-101-:ARGS [ '2021-08-30 08:25:27', 8, 20 ]
    
    [2021-08-30T14:25:27.243Z] DEBUG: server/25546 on host.local:
        PostgreSqlCore:sqlQuery:-101-: {
        command: 'SELECT',
        rowCount: 1,
        rows: [
            {
            id: 1,
            di: 0,
            cr: 2021-08-30T14:25:17.232Z,
            mo: 2021-08-30T14:25:17.232Z,
            unique_key: 'myjob',
            topic: 'myjob',
            group_ref: 'NONE',
            in_process: 0,
            priority: 1000,
            run_at: 2021-08-30T14:25:22.000Z,
            retries: 0,
            fail_at: null,
            last_reason: null,
            json: '{"some":"value","counter":100}'
            }
        ],
        time_ms: 1
        }
    [2021-08-30T14:25:27.243Z] DEBUG: server/25546 on host.local:
     RunQueue::_Poll :>> 1 JOB FOUND.



##### First run / log line
On the first attempt to run this job, we see that our initial counter value is indeed 100. We then return an object with `success: true` to avoid the error-retry-logic, and then, because we want to run this job again with an updated counter value we return (a) `replace: {}` object to signal the request to reschedule ourselves, and (b) an updated `json: string` value with our new state, and (c) an override run_at to request that we immediately be scheduled to run again ...

    ============>> MyJobService:myJobMethod: {
        id: 1,
        di: 0,
        cr: 2021-08-30T14:25:17.232Z,
        mo: 2021-08-30T14:25:17.232Z,
        unique_key: 'myjob',
        topic: 'myjob',
        group_ref: 'NONE',
        in_process: 0,
        priority: 1000,
        run_at: 2021-08-30T14:25:22.000Z,
        retries: 0,
        fail_at: null,
        last_reason: null,
        json: '{"some":"value","counter":100}'
    }
    
    [2021-08-30T14:25:27.248Z] DEBUG: server/25546 on host.local:
        RunQueue::_ProcessTopicResult::TOPIC RESULT FOR myjob :>> {
            topic_result: {
                success: true,
                replace: { run_at: [Array], json: '{"some":"value","counter":101}' }
            }
        }

##### Second run / log line
We get our updated counter of 101. On this run we have planned to throw an error to see how the RunQueue handles it. The expectation is that the error is recorded, the run_at set using the 'standard' back-off strategy, and we should expect to run again later ...

    ============>> MyJobService:myJobMethod: {
        id: 1,
        di: 0,
        cr: 2021-08-30T14:25:17.232Z,
        mo: 2021-08-30T14:25:17.232Z,
        unique_key: 'myjob',
        topic: 'myjob',
        group_ref: 'NONE',
        in_process: 0,
        priority: 1000,
        run_at: 2021-08-30T14:25:27.000Z,
        retries: 0,
        fail_at: null,
        last_reason: null,
        json: '{"some":"value","counter":101}'
    }
    
    [2021-08-30T14:25:32.258Z] DEBUG: server/25546 on host.local:
        RunQueue::_ProcessTopicResult::TOPIC RESULT FOR myjob :>> {
            topic_result: {
                success: false,
                reason: 'Error: I failed hard, pick again\n' +
                '    at MyJobService.myJobMethod (SampleProjects/my_app5/src/myjob_service.js:39:69)\n' +
                '    at Promise.map.concurrency (SampleProjects/my_app5/node_modules/blueprint/lib/runqueue.js:435:48)\n' +
                '    at processTicksAndRejections (node:internal/process/task_queues:96:5)'
            }
        }

##### Third run / log line
It appears we have run 13 seconds later. Our counter is still 101, and we see a `last_reason` failure value. This time we will return a `success: true` and the updated counter.

    ============>> MyJobService:myJobMethod: {
        id: 1,
        di: 0,
        cr: 2021-08-30T14:25:17.232Z,
        mo: 2021-08-30T14:25:17.232Z,
        unique_key: 'myjob',
        topic: 'myjob',
        group_ref: 'NONE',
        in_process: 0,
        priority: 1000,
        run_at: 2021-08-30T14:25:45.000Z,
        retries: 1,
        fail_at: null,
        last_reason: 'Error: I failed hard, pick again\n' +
            '    at MyJobService.myJobMethod (SampleProjects/my_app5/src/myjob_service.js:39:69)\n' +
            '    at Promise.map.concurrency (SampleProjects/my_app5/node_modules/blueprint/lib/runqueue.js:435:48)\n' +
            '    at processTicksAndRejections (node:internal/process/task_queues:96:5)',
        json: '{"some":"value","counter":101}'
    }
    
    [2021-08-30T14:25:47.281Z] DEBUG: server/25546 on host.local:
        RunQueue::_ProcessTopicResult::TOPIC RESULT FOR myjob :>> {
            topic_result: {
                success: true,
                replace: { run_at: [Array], json: '{"some":"value","counter":102}' }
            }
        }

##### Fourth run / log line
Here we get the updated 102 counter value, and we see the last_reason failure text is now empty. We return an updated counter value and reschedule ...

    ============>> MyJobService:myJobMethod: {
        id: 1,
        di: 0,
        cr: 2021-08-30T14:25:17.232Z,
        mo: 2021-08-30T14:25:17.232Z,
        unique_key: 'myjob',
        topic: 'myjob',
        group_ref: 'NONE',
        in_process: 0,
        priority: 1000,
        run_at: 2021-08-30T14:25:47.000Z,
        retries: 0,
        fail_at: null,
        last_reason: null,
        json: '{"some":"value","counter":102}'
    }
    
    [2021-08-30T14:25:52.289Z] DEBUG: server/25546 on host.local:
        RunQueue::_ProcessTopicResult::TOPIC RESULT FOR myjob :>> {
            topic_result: {
                success: true,
                replace: { run_at: [Array], json: '{"some":"value","counter":103}' }
            }
        }

##### Fifth and final run
Here we get the 103 counter value, and return just `success: true` without a `replace: {}` and therefor the job is marked by the RunQueue service as 'done' (i.e. `di` flag set to 1) ...

    ============>> MyJobService:myJobMethod: {
        id: 1,
        di: 0,
        cr: 2021-08-30T14:25:17.232Z,
        mo: 2021-08-30T14:25:17.232Z,
        unique_key: 'myjob',
        topic: 'myjob',
        group_ref: 'NONE',
        in_process: 0,
        priority: 1000,
        run_at: 2021-08-30T14:25:52.000Z,
        retries: 0,
        fail_at: null,
        last_reason: null,
        json: '{"some":"value","counter":103}'
    }
    
    [2021-08-30T14:25:57.301Z] DEBUG: server/25546 on host.local:
     RunQueue::_ProcessTopicResult::TOPIC RESULT FOR myjob :>> { topic_result: { success: true } }


### Starting the API server a second time
This job has a unique key equal to the topic name `myjob`. When the job is added the first time all is good. When we restart the API server (or if another instance of the API server is started against the same DB), there is a duplicate key violation trying to add the job again. Why does this happen, if the job has run to completion successfully? Jobs are left in the DB and marked done using the `di` (disposition) column flag. This is done to allow for viewing the final results of all jobs. If you truly wish to create and run more than one of this type of job on each start-up, you would want to either not set the unique_key, or use a unique_key value that is different each time. For example, for a job of this type ( this 'topic') that is unique for a given user, you could use the unique_key of `topic + ident_id`. A typical use-case is to set the unique_key to the value of the topic, when you want a single reoccurring job that is never done (i.e. always reschedules itself, and is the only job for this topic.) This is how a typical `cron` entry would be implemented.

Here is the output in the console, which in our service was caught and logged, but not re-thrown (so not a fatal server error) If we wanted the API server to fail to start, we would re-throw (or not have caught) this error. (Note: If you wish to run this job again with the same unique_key, try resetting the DB and re-start the server) ...

    ================ >>  error: duplicate key value violates unique constraint "ix_runqueue__unique_key"
        at Parser.parseErrorMessage (SampleProjects/my_app5/node_modules/pg-protocol/dist/parser.js:287:98)
        at Parser.handlePacket (SampleProjects/my_app5/node_modules/pg-protocol/dist/parser.js:126:29)
        at Parser.parse (SampleProjects/my_app5/node_modules/pg-protocol/dist/parser.js:39:38)
        at Socket.<anonymous> (SampleProjects/my_app5/node_modules/pg-protocol/dist/index.js:11:42)
        at Socket.emit (node:events:394:28)
        at Socket.emit (node:domain:475:12)
        at addChunk (node:internal/streams/readable:315:12)
        at readableAddChunk (node:internal/streams/readable:289:9)
        at Socket.Readable.push (node:internal/streams/readable:228:10)
        at TCP.onStreamRead (node:internal/stream_base_commons:199:23)
        at TCP.callbackTrampoline (node:internal/async_hooks:130:17) {
            length: 221,
            severity: 'ERROR',
            code: '23505',
            detail: 'Key (unique_key)=(myjob) already exists.',
            hint: undefined,
            position: undefined,
            internalPosition: undefined,
            internalQuery: undefined,
            where: undefined,
            schema: 'public',
            table: 'runqueue',
            column: undefined,
            dataType: undefined,
            constraint: 'ix_runqueue__unique_key',
            file: 'nbtinsert.c',
            line: '656',
            routine: '_bt_check_unique'
        }
