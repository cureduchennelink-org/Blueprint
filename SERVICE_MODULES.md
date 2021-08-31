# Service Modules
Blueprint.Node is an IoC (inversion of control) framework. This means that developers add 'modules' and the framework will pull these in, instantiate them, and possibly invoke some lifecycle methods. Routes, Services and PSql are all examples of 'modules.' This discussion is specific to `Service modules` - how to create them, configure them, notify Blueprint.Node where they are, and how to indicate that they should be loaded with a given name as reference to the rest of the application.

Technically a 'module' is a single source file on disk. A `Service` is a class defined and exposed in a `Service module.` There can be more than one `Service` in a given module. As you have seen before in previous examples, a config entry under the hash `service_modules: {}` (such as in `src/container.js`) identifies the reference name (or alias), the class name and source-file where a service can be found, and in `src/app.js` you would include the list of services you want to be included on start-up (you can also reference a service in another module, and it will be loaded if that module is also loaded.)

## Service Example
Let's look at a fully populated `Service module` containing multiple `Services` with dependencies on other services, and with all the possible lifecycle methods. Create a single source module for these two service classes `src/my_service.js` ...

    //
    // Service module description goes here
    //
    // (Optional, if you have config entries you expect, put a cut-n-paste-able version here)
    // myServiceOne: { one: 'string-whatever', two: 'string-whatever'}
    //

    // Add any common module requirements (i.e. you can still use the require method for npm modules and library code)
    const Promise = require('bluebird') // You may have to add to package.json, your dependencies
    const _ = require('lodash')
    const { Util } = require('../node_modules/blueprint/lib/Util') // Load a utility from blueprint
    //const localCode = require('./some_local_lib') // Relative to the current module location

    class MyServiceOne {

        static deps() {
            return {

                // These services will be loaded and their lifecycle methods called before yours
                // You reference them as kit.services.NAME
                services: ['error', 'logger', 'config', 'RunQueue'],

                // If you populate this array, you automatically get 'db' service as a dependency
                // You must put these mods into src/app.js also
                psql_mods: ['mypsql'],

                // This is mostly for human consumption currently (future feature: validation)
                // Document for users which config variables you are expecting in the config file
                config: 'myServiceOne{one,two}'
            }
        }

        // All services are instantiated (based on which service depends on which)
        // Next, see below server_use, server_init, server_start for order of operations
        constructor(kit, extraConfig) { // Extra config comes from the config file, see next section
            const f = 'MyServiceOne:constructor:'

            // Load kit services; you can safely grab references here of services you depend on
            // Try not to call their methods yet, or invoke much logic here in the constructor
            this.E = kit.services.error
            this.log = kit.services.logger.log // Used to log outside of a "ctx" context (i.e. not in an endpoint request context)
            this.config = kit.services.config.myServiceOne
            this.runqueue = kit.services.RunQueue
            this.sdb = kit.services.db.psql // The database service which gives us access to 'core' and our psql_mods

            this.log.debug(f, { extraConfig })
            // Process the config entries that may even be environment specific
            this.one = extraConfig.one || this.config.one || 'whatever'

        }

        // Order is server.add_restify_handlers, (all services server_use method), then server.parse_json, server.strip_html
        // Installed using server.use(this-function) - you will be called by Restify for each endpoint request inbound, before route logic
        server_use(req, res, next) {
            const f = 'MyServiceOne:server_use:'
            this.log.debug(f, { req_params: req.params }) // Logging outside of a "ctx" context
            if (req.params.Version !== 'v1') res.send(new Error('I do not like this api version request'))
            return next();
        }

        // Order for _init/_init_promise: (All service server_init(kit) and/or server_init_promise)(kit,promiseChain) in order of service dependency
        async server_init(kit) {
            // Access services that I depend on, but other services are only instantiated at this point.
            const f = 'MyServiceOne:server_init:'
            this.log.debug(f, { kitServices: Object.keys(kit.services) }) // Logging outside of a "ctx" context
        }
        server_init_promise(kit, promiseChain) {
            return promiseChain.then(() => {
                // Do something inside a promise chain
                const f = 'MyServiceOne:server_init_promise:'
                this.log.debug(f, { kitServices: Object.keys(kit.services) }) // Logging outside of a "ctx" context
            })
        }

        // Next (after *_init) all routes are instantiated, then all routes.server_init(kit) called, then each services server_start(kit)
        async server_start(kit) {
            // All services I depend on are 'start'ed and all services are at least 'init'ed. Also, all routes are instantiated and 'init'ed
            const f = 'MyServiceOne:server_start:'
            this.log.debug(f, { kitServices: Object.keys(kit.services) }) // Logging outside of a "ctx" context
            this.longHeldHandle = await this.sdb.core.Acquire(); // Could get a DB handle at this point
        }

        jobMethod(job) {
            // Services can expose methods that implement jobs from the RunQueue (referenced in the 'topic' config as '<service-alias>.jobMethod')
            const f = 'MyServiceOne:jobMethod:'
            this.log.debug(f, { kitServices: Object.keys(kit.services) }) // Logging outside of a "ctx" context
        }

        // Other services and any routes can call any method in any order, but most will do so only after your server_init() is called.
        async anyMethod(ctx, some, params) {
            // Best practice is to pass down a 'ctx' value, especially from route logic, which holds a DB handle and logging context
            const f = 'MyServiceOne:anyMethod:'
            ctx.log.debug(f, { some, params }) // Logging your inbound params makes it easier to figure out what went wrong where

            var dbRows, dbResult // If you reuse these names for all DB related staging vars prior to parity checks on results, you code is more cut-n-paste-able
            const returnObject = {}

            dbRows = await this.sdb.mypsql.reader(ctx, params)
            if (dbRows.length === 0) throw new this.E.NotFoundError(f + 'mypsql.reader')
            returnObject.things = dbRows

            // Alternatively, if you expect exactly one row, enforce that here, to detect misconfigured DB tables
            if (dbRows.length !== 1) throw new this.E.NotFoundError(f + 'mypsql.reader.' + dbRows.length)
            returnObject.thing = dbRows[0]

            return returnObject
        }
    }
    exports.MyServiceOne = MyServiceOne

    // Minimal service, exposes a simple method that multiple routes use, as an example
    class MyServiceTwo {

        static deps() {
            return { services: ['MyServiceOneAlias'], psql_mods: [], config: '' }
        }

        constructor(kit, extraConfig) {
            this.cache = extraConfig || {} // Optionally can set an initial cache from the config file
        }

        get(name) {
            return this.cache[name]
        }

        put(name, value) {
            this.cache[name] = value;
        }
    }
    exports.MyServiceTwo = MyServiceTwo

## Config example
Imagine we want one instance of `MyServiceOne` and two instances of `MyServiceTwo` with separately configured caches. You might do it like this ...

    myServiceOne: {one: 1, two: 2}, // Configuration for MyServiceOne service
    service_modules: {
        MyServiceOneAlias: { class: 'MyServiceOne', file: 'src/my_service', instConfig: {one: 3}},
        MyServiceTwoA: { class: 'MyServiceTwo', file: 'src/my_service', instConfig: {item1: 'x', item2: 'y'}},
        MyServiceTwoB: { class: 'MyServiceTwo', file: 'src/my_service', instConfig: {item1: 'a', item2: 'b'}},
    },

## Pulling in services
Let's update `src/app.js` with just the `MyServiceTwo` aliases (A and B) and we expect `MyServiceOne` to load automatically because of the dependency we put into `static deps()` for the service class `MyServiceTwo` ...

    // Lists of modules to include on start-up
    const services = ['db', 'auth', 'lamd', 'RunQueue', 'MyJobService', 'MyServiceTwoA', 'MyServiceTwoB']

## Run and view the logs
Start the API server, and notice the log line output from our services. Using `const f=` and `logFunction(f, ...)` should allow us to identify each place we logged in each class/method we did the logging (Note, your src/container.js depends on some ENV vars being set) ...

    export DBHOST=localhost
    export DBNAME=local_yourapp_yourname
    node src/app.js | bunyan -o short

### Looking at the log output
These lines should help us understand the order of things loading; I am going to show pretty much everything that is output on start-up and talk through it ...

##### Run app from cmdline with ENV vars set
    sh-3.2$  export DBHOST=localhost
    sh-3.2$  export DBNAME=local_yourapp_yourname
    sh-3.2$  node src/app.js | bunyan -o short
##### First few lines show where Blueprint.Node will look for your config file (dir and file)
    Environment specified: container
    Config Dir specified: src
    Env Config Path: /Users/james.shelby/Clients/SampleProjects/my_app7/src/container.js
    Environment configuration found: /Users/james.shelby/Clients/SampleProjects/my_app7/src/container.js
#### Kit will show what it is doing as it determines which services depend on which
##### Logger is a hardcoded file and loaded first, to log all other actions
    Kit::new_service:  { name: 'logger', constructor: [class Logger] }
##### Now the logger is used vs. console.log (this is a Bunyan logger) 
`Service Initialized...` is logged before attempting a `new` on the class

    19:37:40.711Z  INFO server: Logger Initialized...
    19:37:40.889Z  INFO server: Server Initialized...
##### These lines show the process of gathering dependencies using `static deps()`
    19:37:40.891Z DEBUG server: Kit::get_service_deps_needed:  { name: 'FruitRoute', constructor: [class FruitRoute] }
    19:37:40.891Z DEBUG server: Kit::get_service_deps_needed:  { name: 'JunkRoute', constructor: [class JunkRoute] }
    19:37:40.892Z DEBUG server: Kit::get_service_deps_needed:  { name: 'Auth', constructor: [class AuthRoute] }
    19:37:40.894Z DEBUG server: Kit::get_service_deps_needed:  { name: 'Health', constructor: [class HealthCheck] }
    19:37:40.894Z DEBUG server: Kit::get_service_deps_needed:  { name: 'db', constructor: [class Db] }
    19:37:40.896Z DEBUG server: Kit::get_service_deps_needed:  { name: 'auth', constructor: [class Auth] }
    19:37:40.897Z DEBUG server: Kit::get_service_deps_needed:  { name: 'lamd', constructor: [class PLamd] }
    19:37:40.900Z DEBUG server: Kit::get_service_deps_needed:  { name: 'RunQueue', constructor: [class RunQueue] }
    19:37:40.901Z DEBUG server: Kit::get_service_deps_needed:  { name: 'MyJobService', constructor: [class MyJobService] }
    19:37:40.903Z DEBUG server: Kit::get_service_deps_needed:  { name: 'MyServiceTwoA', constructor: [class MyServiceTwo] }
    19:37:40.903Z DEBUG server: Kit::get_service_deps_needed:  { name: 'MyServiceTwoB', constructor: [class MyServiceTwo] }
    19:37:40.905Z DEBUG server: Kit::get_service_deps_needed:  { name: 'wrapper', constructor: [class Wrapper] }
    19:37:40.906Z DEBUG server: Kit::get_service_deps_needed:  { name: 'router', constructor: [class Router] }
    19:37:41.088Z DEBUG server: Kit::get_service_deps_needed:  { name: 'ses', constructor: [class SES] }
    19:37:41.089Z DEBUG server: Kit::get_service_deps_needed:  { name: 'tripMgr', constructor: [class TripManager] }
    19:37:41.089Z DEBUG server: Kit::get_service_deps_needed:  { name: 'tokenMgr', constructor: [class TokenMgr] }
    19:37:41.090Z DEBUG server: Kit::get_service_deps_needed:  { name: 'event', constructor: [class Event extends EventEmitter] }
    19:37:41.104Z DEBUG server: Kit::get_service_deps_needed:  { name: 'slack', constructor: [class Slack] }
    19:37:41.104Z DEBUG server: Kit::get_service_deps_needed:  { name: 'MyServiceOneAlias', constructor: [class MyServiceOne] }
    19:37:41.105Z DEBUG server: Kit::get_service_deps_needed:  { name: 'template_use', constructor: [class EpicTemplate] }
    19:37:41.105Z DEBUG server: Kit::get_service_deps_needed:  { name: 'template', constructor: [class EpicTemplate] }
##### Final determination of services, routes, and psql-mods that will be required
    19:37:41.106Z DEBUG server:
        (Start)Index::update_deps:FINAL {
##### This is the full list of services to be loaded, and the order they will load in
Notice our 3 services have names that we gave them different from the class names in the source file

        all_services: [
            'tokenMgr',      'db',
            'auth',          'lamd',
            'slack',         'RunQueue',
            'MyJobService',  'MyServiceOneAlias',
            'MyServiceTwoA', 'MyServiceTwoB',
            'template_use',  'router',
            'wrapper',       'template',
            'ses',           'tripMgr',
            'event'
        ],
##### This is a breakdown of which services were requested by whom
Notice our `MyServiceOneAlias` was requested by [ 'MyServiceTwoA', 'MyServiceTwoB' ]

        s2child: {
            db: [ 'auth', 'lamd', 'RunQueue', 'MyJobService', 'tripMgr' ],
            auth: [],
            tokenMgr: [ 'auth', 'tripMgr' ],
            lamd: [],
            RunQueue: [ 'MyJobService', 'MyServiceOneAlias' ],
            slack: [ 'RunQueue' ],
            MyJobService: [],
            MyServiceTwoA: [],
            MyServiceOneAlias: [ 'MyServiceTwoA', 'MyServiceTwoB' ],
            MyServiceTwoB: [],
            wrapper: [],
            router: [ 'wrapper' ],
            template_use: [ 'router' ],
            ses: [],
            template: [ 'ses' ],
            tripMgr: [],
            event: []
        }
        }
##### Again "Initializing XXX Service..." appears before calling 'new', and additional details on the following line
    19:37:41.106Z  INFO server: Initializing TokenMgr Service...
    19:37:41.106Z DEBUG server: Kit::new_service:  { name: 'tokenMgr', constructor: [class TokenMgr] }
##### "Db" service is the one that loads up psql drivers and it loads requested psql-mods
    19:37:41.107Z  INFO server: Initializing Db Service...
    19:37:41.107Z DEBUG server: Kit::new_service:  { name: 'db', constructor: [class Db] }
    19:37:41.135Z  INFO server: Initializing PostgreSql...
##### These lines show the loading psql-mods, showing MOD-NAME @ FILE-NAME :: CLASS-NAME
If there is a failure due to a misspelling in your config, it should fail with an error right after this line appears

    19:37:41.135Z  INFO server: Loading PostgreSql module junk@/Users/james.shelby/Clients/SampleProjects/my_app7/src/psql_junk::PSqlJunk
    19:37:41.136Z  INFO server: Loading PostgreSql module auth@/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/blueprint/lib/db/_postgresql/sql_auth::SqlAuth
    19:37:41.137Z  INFO server: Loading PostgreSql module token@/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/blueprint/lib/db/_postgresql/sql_token::SqlToken
    19:37:41.137Z  INFO server: Loading PostgreSql module lamd@/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/blueprint/lib/db/_postgresql/psql_lamd::PSqlLamd
    19:37:41.138Z  INFO server: Loading PostgreSql module runqueue@/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/blueprint/lib/db/_postgresql/psql_runqueue::PSqlRunQueue
##### Next Auth, PLamd, Slack, RunQueue - and RunQueue has debug in the constructor
    19:37:41.139Z  INFO server: Initializing Auth Service...
    19:37:41.139Z DEBUG server: Kit::new_service:  { name: 'auth', constructor: [class Auth] }
    19:37:41.139Z  INFO server: Initializing PLamd Service...
    19:37:41.139Z DEBUG server: Kit::new_service:  { name: 'lamd', constructor: [class PLamd] }
    19:37:41.139Z  INFO server: Initializing Slack Service...
    19:37:41.139Z DEBUG server: Kit::new_service:  { name: 'slack', constructor: [class Slack] }
    19:37:41.139Z  INFO server: Initializing RunQueue Service...
    19:37:41.140Z DEBUG server: Kit::new_service:  { name: 'RunQueue', constructor: [class RunQueue] }
##### RunQueue shows the full raw config that it will be working from
    RUNQUEUE {
    settings: {
        poll_interval_ms: false,
        jobs: 100,
        read_depth: 20,
        pollLogDelay: { quantity: 5, measurement: 'm' }
    },
    topic_defaults: {
        back_off: 'standard',
        last_fail: false,
        priority: 1000,
        group_ref: 'NONE',
        limit: 1000000,
        alarm_cnt: 8,
        warn_cnt: 3,
        warn_delay: [ 3, 'm' ],
        alarm_delay: [ 10, 'm' ],
        fail_at: [ 5, 'm' ]
    },
    external_groups: {
        default: { connections: 1000000, requests: [Array] },
        SES: {},
        SampleTest: {}
    },
    topics: {
        myjob: {
        service: 'MyJobService.myJobMethod',
        type: 'whatever you like here: do once and quit',
        unique_key: 'myjob',
        priority: 1000,
        run_at: [Array]
        }
    },
    SAMPLE_topics: {
        alert_tropo: {
        service: 'IvyHealth.TropoAlert',
        type: 'per-user',
        priority: 300,
        run_at: [Array],
        group_ref: 'Tropo'
        },
        alert_ses: {
        service: 'IvyHealth.SesAlert',
        type: 'per-user',
        priority: 320,
        run_at: [Array],
        group_ref: 'SES'
        },
        poll_ivy_user: {
        service: 'IvyHealth.Readings',
        type: 'per-user,reoccur,fanout',
        priority: 350,
        run_at: [Array],
        group_ref: 'IvyHealth'
        }
    },
    DISABLED_topics: {
        email_daily_user: {
        service: 'Reports.Daily',
        type: 'per-user,reoccur',
        priority: 900,
        run_at: [Array],
        group_ref: 'SES'
        },
        email_weekly_user: {
        service: 'Reports.Weekly',
        type: 'per-user,reoccur',
        priority: 950,
        run_at: [Array],
        group_ref: 'SES'
        }
    }
    }
##### Next, RunQueue shows the "computed" list of "topics" and "groups" it will be processing for jobs
    19:37:41.141Z DEBUG server:
        RunQueue::constructor:: {
        topics: {
            myjob: {
            nm: 'myjob',
            back_off: 'standard',
            last_fail: false,
            priority: 1000,
            group_ref: 'NONE',
            limit: 1000000,
            alarm_cnt: 8,
            warn_cnt: 3,
            warn_delay: [Array],
            alarm_delay: [Array],
            fail_at: [Array],
            service: 'MyJobService.myJobMethod',
            type: 'whatever you like here: do once and quit',
            unique_key: 'myjob',
            run_at: [Array]
            }
        },
        groups: {
            SES: { connections: 1000000, requests: [Array] },
            SampleTest: { connections: 1000000, requests: [Array] }
        }
        }
    19:37:41.141Z  INFO server: Initializing MyJobService Service...
    19:37:41.141Z DEBUG server: Kit::new_service:  { name: 'MyJobService', constructor: [class MyJobService] }
##### Here is our MyServiceOne class loading with the name MyServiceOneAlias (before any MyServiceTwo? services load)
    19:37:41.141Z  INFO server: Initializing MyServiceOne Service...
    19:37:41.141Z DEBUG server: Kit::new_service:  { name: 'MyServiceOneAlias', constructor: [class MyServiceOne] }
##### This is our constructor log message, showing the extraConfig info
    19:37:41.141Z DEBUG server: MyServiceOne:constructor: { extraConfig: { one: 3 } }
##### Now our MyServiceTwo services load - one for each alias with separate instance configs (extraConfig not logged)
    19:37:41.141Z  INFO server: Initializing MyServiceTwo Service...
    19:37:41.141Z DEBUG server: Kit::new_service:  { name: 'MyServiceTwoA', constructor: [class MyServiceTwo] }
    19:37:41.141Z  INFO server: Initializing MyServiceTwo Service...
    19:37:41.142Z DEBUG server: Kit::new_service:  { name: 'MyServiceTwoB', constructor: [class MyServiceTwo] }
##### Several other services load to support or overall API server instance
    19:37:41.142Z  INFO server: Initializing EpicTemplate Service...
    19:37:41.142Z DEBUG server: Kit::new_service:  { name: 'template_use', constructor: [class EpicTemplate] }
    19:37:41.146Z DEBUG server: :ViewExec
    19:37:41.146Z  INFO server: Initializing Router Service...
    19:37:41.146Z DEBUG server: Kit::new_service:  { name: 'router', constructor: [class Router] }
    19:37:41.146Z  INFO server: Initializing Wrapper Service...
    19:37:41.146Z DEBUG server: Kit::new_service:  { name: 'wrapper', constructor: [class Wrapper] }
    19:37:41.146Z  INFO server: Initializing EpicTemplate Service...
    19:37:41.146Z DEBUG server: Kit::new_service:  { name: 'template', constructor: [class EpicTemplate] }
    19:37:41.146Z DEBUG server: :ViewExec
    19:37:41.146Z  INFO server: Initializing SES Service...
    19:37:41.146Z DEBUG server: Kit::new_service:  { name: 'ses', constructor: [class SES] }
    19:37:41.152Z  INFO server: Initializing TripManager Service...
    19:37:41.152Z DEBUG server: Kit::new_service:  { name: 'tripMgr', constructor: [class TripManager] }
    19:37:41.152Z  INFO server: Initializing Event Service...
    19:37:41.152Z DEBUG server: Kit::new_service:  { name: 'event', constructor: [class Event extends EventEmitter] }
##### Now all constructors for all services have run, we load Restify pre-parsers
    19:37:41.152Z  INFO server: (restify handler) Server.use queryParser { mapParams: true }
    19:37:41.152Z  INFO server: (restify handler) Server.use bodyParser { mapParams: true }
    19:37:41.152Z  INFO server: (restify handler) Server.use requestLogger undefined
    19:37:41.153Z  INFO server: (restify handler) Server.use authorizationParser undefined
##### Now we load our services that have a `server_use` method as pre-parsers (or middleware)
    19:37:41.153Z  INFO server: Calling server.use for service: logger
    19:37:41.153Z  INFO server: Calling server.use for service: restify_logger
    19:37:41.153Z  INFO server: Calling server.use for service: auth
##### Here is out MyServiceOneAlias being installed
This method is not called yet, hence no log lines from our logging - this happens when requests arrive at the API

    19:37:41.153Z  INFO server: Calling server.use for service: MyServiceOneAlias
##### Now all the route modules are initialized (new is called on their class definitions)
    19:37:41.154Z  INFO server: Initializing FruitRoute Routes...
    19:37:41.154Z DEBUG server: Kit::new_route_service:  { name: 'FruitRoute', constructor: [class FruitRoute] }
    19:37:41.155Z  INFO server: Initializing JunkRoute Routes...
    19:37:41.155Z DEBUG server: Kit::new_route_service:  { name: 'JunkRoute', constructor: [class JunkRoute] }
    19:37:41.156Z  INFO server: Initializing AuthRoute Routes...
    19:37:41.156Z DEBUG server: Kit::new_route_service:  { name: 'Auth', constructor: [class AuthRoute] }
    19:37:41.157Z  INFO server: Initializing HealthCheck Routes...
    19:37:41.157Z DEBUG server: Kit::new_route_service:  { name: 'Health', constructor: [class HealthCheck] }
##### Deprecation warning, possibly related to Restify and use of spdy.js
    (node:14711) [DEP0111] DeprecationWarning: Access to process.binding('http_parser') is deprecated.
    (Use `node --trace-deprecation ...` to show where the warning was created)
    Tue, 31 Aug 2021 19:37:41 GMT warning: {
    name: 'DeprecationWarning',
    message: "Access to process.binding('http_parser') is deprecated.",
    stack: "DeprecationWarning: Access to process.binding('http_parser') is deprecated.\n" +
        '    at process.binding (node:internal/bootstrap/loaders:133:17)\n' +
        '    at Object.<anonymous> (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/http-deceiver/lib/deceiver.js:22:24)\n' +
        '    at Module._compile (node:internal/modules/cjs/loader:1101:14)\n' +
        '    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1153:10)\n' +
        '    at Module.load (node:internal/modules/cjs/loader:981:32)\n' +
        '    at Function.Module._load (node:internal/modules/cjs/loader:822:12)\n' +
        '    at Module.require (node:internal/modules/cjs/loader:1005:19)\n' +
        '    at require (node:internal/modules/cjs/helpers:94:18)\n' +
        '    at Object.<anonymous> (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/spdy/lib/spdy/handle.js:5:20)\n' +
        '    at Module._compile (node:internal/modules/cjs/loader:1101:14)\n' +
        '    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1153:10)\n' +
        '    at Module.load (node:internal/modules/cjs/loader:981:32)\n' +
        '    at Function.Module._load (node:internal/modules/cjs/loader:822:12)\n' +
        '    at Module.require (node:internal/modules/cjs/loader:1005:19)\n' +
        '    at require (node:internal/modules/cjs/helpers:94:18)\n' +
        '    at Object.<anonymous> (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/spdy/lib/spdy.js:6:15)'
    }
##### Next the Route/Wrapper services are installing all the endpoints into Restify verb+path
    19:37:41.160Z  INFO server:      GET  /api/:Version/Fruit
    19:37:41.161Z  INFO server:      DEL  /api/:Version/Fruit/:frid/eat
    19:37:41.161Z  INFO server:      POST /api/:Version/Fruit/:frid/eat
    19:37:41.162Z  INFO server:      POST /api/:Version/Auth
    19:37:41.162Z  INFO server:      PUT  /api/:Version/Auth/:auid/updatepassword
    19:37:41.162Z  INFO server:      POST /api/:Version/Auth/:auid/updatepassword
    19:37:41.162Z  INFO server:      POST /api/:Version/Auth/:auid/updateemail
    19:37:41.162Z  INFO server:      POST /api/:Version/AuthChange
    19:37:41.162Z  INFO server:      GET  /api/:Version/AuthChange/:token
    19:37:41.163Z  INFO server:      POST /api/:Version/AuthChange/:token/verifyforgot
    19:37:41.166Z  INFO server:      POST /api/:Version/AuthChange/:token/verifyemail
    19:37:41.166Z  INFO server:      GET  /api/:Version/PingAuth
    19:37:41.166Z  INFO server:      GET  /api/:Version/Ping
    19:37:41.167Z  INFO server:      GET  /api/:Version/Logs/pingComprehensive
    19:37:41.167Z  INFO server:      GET  /api/:Version/Junk
    19:37:41.167Z  INFO server:      DEL  /api/:Version/Junk/:id/remove
    19:37:41.168Z  INFO server:      POST /api/:Version/Junk/:id/remove
    19:37:41.168Z  INFO server:      GET  /api/:Version/Logs
    19:37:41.168Z  INFO server:      GET  /api/:Version/Debug/:req_uuid
    19:37:41.168Z  INFO server:      GET  /api/:Version/ServiceHealth
##### Next server_init and server_init_promise on each service is being called. This is our log line showing
    19:37:41.182Z DEBUG server:
        MyServiceOne:server_init: {
            kitServices: [
                'config',            'logger',
                'error',             'restify_logger',
                'server',            'tokenMgr',
                'db',                'auth',
                'lamd',              'slack',
                'RunQueue',          'MyJobService',
                'MyServiceOneAlias', 'MyServiceTwoA',
                'MyServiceTwoB',     'template_use',
                'router',            'wrapper',
                'template',          'ses',
                'tripMgr',           'event'
            ]
        }
    19:37:41.182Z DEBUG server:
        MyServiceOne:server_init_promise: {
            kitServices: [
                'config',            'logger',
                'error',             'restify_logger',
                'server',            'tokenMgr',
                'db',                'auth',
                'lamd',              'slack',
                'RunQueue',          'MyJobService',
                'MyServiceOneAlias', 'MyServiceTwoA',
                'MyServiceTwoB',     'template_use',
                'router',            'wrapper',
                'template',          'ses',
                'tripMgr',           'event'
            ]
        }
##### Next server_start on each service is called
    19:37:41.183Z DEBUG server:
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
##### Services are starting to process things - here the RunQueue is beginning to poll the DB
    19:37:41.185Z DEBUG server: RunQueue::_PollWrapper::USING DEFAULT INTERVAL :>> 5000
    RUNQUEUE { interval: 5000 }
    RUNQUEUE:BEFORE { interval: 5000 }
##### Our old MyJobService is running service_start to add the one job to the queue; it already exists and catches and logs the error
    19:37:41.195Z DEBUG server: PostgreSqlCore:sqlQuery:-101-:PSQL:10 INSERT INTO runqueue ( in_process,retries,fail_at,last_reason,priority,unique_key,topic,json,run_at,group_ref ) VALUES ( $1,$2,$3,$4,$5,$6,$7,$8,$9,$10 )
    19:37:41.196Z DEBUG server:
        PostgreSqlCore:sqlQuery:-101-:ARGS [
            0,
            0,
            null,
            null,
            1000,
            'myjob',
            'myjob',
            '{"some":"value","counter":100}',
            '2021-08-31 13:37:46',
            'NONE'
        ]
    ================ >>  error: duplicate key value violates unique constraint "ix_runqueue__unique_key"
        at Parser.parseErrorMessage (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/pg-protocol/dist/parser.js:287:98)
        at Parser.handlePacket (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/pg-protocol/dist/parser.js:126:29)
        at Parser.parse (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/pg-protocol/dist/parser.js:39:38)
        at Socket.<anonymous> (/Users/james.shelby/Clients/SampleProjects/my_app7/node_modules/pg-protocol/dist/index.js:11:42)
        at Socket.emit (node:events:394:28)
        at Socket.emit (node:domain:475:12)
        at addChunk (node:internal/streams/readable:315:12)
        at readableAddChunk (node:internal/streams/readable:289:9)
        at Socket.Readable.push (node:internal/streams/readable:228:10)
        at TCP.onStreamRead (node:internal/stream_base_commons:199:23) {
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
##### Our MyServiceOne is having server_start called now
    19:37:41.230Z DEBUG server:
        MyServiceOne:server_start: {
            kitServices: [
                'config',            'logger',
                'error',             'restify_logger',
                'server',            'tokenMgr',
                'db',                'auth',
                'lamd',              'slack',
                'RunQueue',          'MyJobService',
                'MyServiceOneAlias', 'MyServiceTwoA',
                'MyServiceTwoB',     'template_use',
                'router',            'wrapper',
                'template',          'ses',
                'tripMgr',           'event'
            ]
        }
##### All services have been 'started' so we now add the static file server and start the Restify listener to start taking endpoint requests
    19:37:41.231Z DEBUG server:
        (restify) serveStatic {
            path: '/*',
            '@config.api.static_file_server': { directory: './html_root', default: 'index.html' }
        }
##### A few built-in success lines (port we are listening on, node server version running, etc.)
    19:37:41.234Z  INFO server: Server listening at http://[::]:9500
    19:37:41.235Z DEBUG server: SERVER NORMAL START
    v16.7.0
    Node.js in service on port: 9500
##### This is our .next log line in src/app.js after the server start promises are all complete
    API server is ready.  http://localhost:9500/api/v1

