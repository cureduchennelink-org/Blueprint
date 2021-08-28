# Runqueue - Scalable Job Scheduler and Runner
Work that is (or can be) done by our API servers but is not work caused by an endpoint request, falls into the category of "jobs." A job is implemented as a method of a service module. It can be reoccuring or run just once. If there is an error, it can be retried several times. When mulitple API instances are running, the Runqueue service will ensure that a job does not get scheduled to run more than once at a time. The service also will typically spread work out across servers, and can group jobs for the purpose of limiting the number of in-flight jobs in a group.

## Use cases
For re-occurring jobs, this system is designed for scheduling a job that run at most every few seconds; it is not much granular than about every second. It also is designed to support many thousands of scheduled jobs in the queue, most of which run once, and many run each min or hour or longer apart. For example, if you can just onboarded a user, but they have not yet finished some part of their profile, and you wish to send them an email an hour from now if they have not yet completed it - you can add a job during onboarding to run one hour in the future. Then, you can either have that job check that it is still valid to send the email, and either send it or not, but then exit - or you can assign a unique_key to the job when you create it, and when they finish the profile task, you can just delete this job before it runs. For this job to know which user it was create for, you would set the `json` state value when you create this job.

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
In the Bluprint default configuration there are several sane default settings. Your config only needs to add where these are not desirable. You would create a `runqueue:` hash at the top level of your `src/container.js` config file, and at least define a `topics:` object for each of your job topics. The following is what is in Blueprint.Node default config which includes a few sample topics ...

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
A "topic" is a generic description of a job - kind of a "job type." It is a list of attributes common to all jobs of this type, where individual jobs can override some of these attribute values. There are also application defaults for topics. An example of a daily email report might be ...

			email_daily_user: {
				service: 'Reports.Daily', type: 'per-user,reoccur',
				priority: 900, run_at: [1,'day'], group_ref: 'SES'
			},

##### service
This hash gives the "service name" (from kit.services[ name]) a dot and "method name." This is the method that will be called when jobs of this type are scheduled.

##### type
A string that is ignored; for human consumption. Is this a one-and-done or re-occuring? Let people know what one job represents

##### priority
Any number, which is going to be part of the sort-by when pulling jobs to start running them. Lower numbers are executed first

##### run_at
This can be a string date, or an array representing a relative value. It can occur here, but it can also be set by your logic when a job is being added to the DB.

##### group_ref
This is any string to "group" various jobs (from various topics) together, to address resource limitations. For example, if SES only allowed 10 simultanious connections sending emails, you could group all email sending jobs with this string "SES" and in the group definition / configuration limit it to 10 jobs at a time. This value works accross multiple servers.

### The following are defaulted to reasonable values, but can be changed per-topic if needed

##### back_off: 'standard'
A "strategy" for when to 'retry' after errors. The Runqueue service has defined 'standard' (exponential), 'year' (for testing), 'immeadiate' ([0,'s'])

##### limit: rq_max
Maximum in-flight jobs of this type
##### alarm_cnt: 8
Number of retries this job has reached where a 'red' status should be reported by the health-check endpionts.
Once this count has been reached, the job will stop being scheduled.
##### warn_cnt: 3
Number of retries this job has reached where a 'yellow' status should be reported by the health-check endpionts
##### warn_delay: [3,'m']
Amount of time this job has been waiting in the queue to run, where a 'yellow' status should be reported by the health-check endpionts
##### alarm_delay: [10,'m']
Amount of time this job has been waiting in the queue to run, where a 'red' status should be reported by the health-check endpionts
##### fail_at: [5, 'm']
How long a job can run before it is considered to have failed (possibly hung, or never returned) This timestamp can sometimes be exceeded if the server has crashed while the job was marked as in-process. It is only used to create a 'red' alarm in the health-check endpoints


## Sample service to play with
Let's create a service that exposes a method that can be used to run jobs in the Runqueue DB.
For more information on how service modules work, see [SERVICE_MODLES.md](SERVICE_MODLES.md)
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
    //    unique_key: 'myjob', priority: 1000, run_at: [5,'s'], group_ref: 'mygroup'
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
                if (e.code=== '23505' && e.constraint=== 'ix_runqueue__unique_key') {} // PostgreSQL dup key error, this is ok with us, igrnore it
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

            // When we have done eerything...
            if (this.counter > 103) return { success: true } // We finished, don't call this job again

            // Record state for next round, choose a run_at that reschedule ourselves immeadiately, to finish the work
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
Also, to load this new service and to include Runqueue's dependancies, add to 'services' RunQueue and MyJobService, also to psql_mods 'runqueue' - update `src/app.js` ...

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

    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql
