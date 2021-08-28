# Runqueue - Scalable Job Scheduler and Runner



## Sample service to play with

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


### src/app.js

    // Lists of modules to include on start-up
    const services = ['db', 'auth', 'lamd', 'RunQueue', 'MyJobService']
    const routes = ['FruitRoute', 'JunkRoute', 'Auth', 'Health', ]
    const psql_mods = ['junk', 'auth', 'token', 'lamd', 'runqueue']

### src/container.js

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


### db/scripts/V1__base.js

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

