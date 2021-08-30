# Service Modules
Blueprint.Node is an IoC (inversion of control) framework. This means that developers add 'modules' and the framework will pull these in, instantiate them, and possibly invoke some lifecycle methods. Routes, Services and PSql are all examples of 'modules.' This discussion is specific to `Service modules` - how to create them, configure them, notify Blueprint.Node where they are, and how to indicate that they should be loaded with a given name as reference to the rest of the application.

Technically a 'module' is a single source file on disk. A `Service` is a class defined and exposed in a `Service module.` There can be more than one `Service` in a given module. As you have seen before in previous examples, a config entry under the hash `service_modules: {}` (such as in `src/container.js`) identifies the reference name (or alias), the class name and source-file where a service can be found, and in `src/app.js` you would include the list of services you want to be included on start-up (you can also reference a service in another module, and it will be loaded if that module is also loaded.)

## Service Example
Let's look at a fully populated `Service module` containing multiple `Services` with dependencies on other services, and with all the possible lifecycle methods ...

    //
    // Service module description goes here
    //

    // Add any common module requirements (i.e. you can still use the require method for npm modules and library code)
    const Promise= require( 'bluebird') // You may have to add to package.json, your dependencies
    const _= require( 'lodash')
    const {Util}= require( './node_modules/blueprint/lib/Util') // Load a utility from blueprint
    const localCode= require( './some_local_lib') // Relative to the current module's location

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
                config: 'myServiceOne{one,two}'}
        }

        // All services are instantiated (based on which service depends on which)
        // Next, see below server_use, server_init, server_start for order of operations
        constructor(kit, extraConfig) { // Extra config comes from the config file, see next section

            // Load kit services; you can safely grab references here of services you depend on
            // Try not to call their methods yet, or invoke much logic here in the constructor
            this.E= kit.services.error
            this.log= kit.services.logger.log
            this.config= kit.services.config.myServiceOne
            this.runqueue= kit.services.RunQueue
            this.sdb= kit.services.db.psql // The database service which gives us access to 'core' and our psql_mods

            // Process the config entries that may even be environment specific
            this.one= extraConfig.one || this.config.one || 'whatever'

        }

        // Order is server.add_restify_handlers, (all services' server_use), then server.parse_json, server.strip_html
        // Installed using server.use(this-function) - you will be called by Restify for each endpoint request inbound, before route logic
        server_use( req, res, next){
            if (req.params.Version !== 'v1') res.send( throw new Error( 'I do not like this api version request'))
            return next();
        }

        // Order for _init/_init_promise: (All services' server_init(kit) and/or server_init_promise)(kit,promiseChain) in order of service dependency
        async server_init(kit){
            // Access services that I depend on, but other services are only instantiated at this point.
        }
        server_init_promise( kit, promiseChain) {
            return promiseChain.then( ()=> {
                // Do something inside a promise chain
            })
        }

        // Next (after *_init) all routes are instantiated, then all routes.server_init(kit) called, then each services' server_start(kit)
        async server_start(kit){
            // All services I depend on are 'start'ed and all services are at least 'init'ed. Also, all routes are instantiated and 'init'ed
            this.longHeldHandle= await this.sdb.core.Acquire(); // Could get a DB handle at this point
        }

        jobMethod( job){
            // Services can expose methods that implement jobs from the RunQueue (referenced in the 'topic' config as '<service-alias>.jobMethod')
        }

        // Other services and any routes can call any method in any order, but most will do so only after your server_init() is called.
        anyMethod( ctx, some, params){
            // Best practice is to pass down a 'ctx' value, especially from route logic, which holds a DB handle and logging context
            const f= 'MyServiceOne:anyMethod:'
            ctx.log.debug( f, {some, params}) // Logging your inbound params makes it easier to figure out what when wrong where

            var dbRows, dbResult // If you reuse these names for all DB related staging vars prior to parity checks on results, you code is more cut-n-paste-able
            const returnObject= {}

            dbRows= await this.sdb.mypsql.reader( ctx, params)
            if (dbRows.length=== 0) throw new this.E.NotFound( f+ 'mypsql.reader')
            returnObject.things= dbRows

            // Alternatively, if you expect exactly one row, enforce that here, to detect misconfigured DB tables
            if (dbRows.length!== 1)  throw new this.E.NotFound( f+ 'mypsql.reader.'+ dbRows.length)
            returnObject.thing= dbRows[ 0]

            return returnObject
        }
    }
exports.MyServiceOne= MyServiceOne

    // Minimal service, exposes a simple method that multiple routes use, as an example
    class MyServiceTwo {
        
        static deps() {
            return {services: [], psql_mods: [], config: ''}
        }

        // Order is, all services are instantiated (based on which service depends on which), next (see below server_use, server_init, server_start)
        constructor(kit, extraConfig) {
            this.cache= extraConfig || {} // Optionally can set an initial cache from the config file
        }

        get( name){
            return this.cache[ name]
        }

        put( name, value){
            this.cache[ name]= value;
        }
    }
exports.MyServiceTwo= MyServiceTwo

## Config example
Imagine we want one instance of `MyServiceOne` and two instances of `MyServiceTwo` with separately configured caches. You might do it like this ...

    service_modules: {
        MyServiceOneAlias: { class: 'MyServiceOne', file: 'src/my_service', opts: {one: 3}},
        MyServiceTwoA: { class: 'MyServiceTwo', file: 'src/my_service', opts: {item1: 'x', item2: 'y'}},
        MyServiceTwoB: { class: 'MyServiceTwo', file: 'src/my_service', opts: {item1: 'a', item2: 'b'}},
    },
    myServiceOne: {one: 1, two: 2}, // Configuration for MyServiceOne service
