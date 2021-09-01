# Building APIs with Route modules
The REST model typically involves endpoints that are grouped around the concept of a `Resource`. Generally speaking, a route module can be used to encapsulate a Resource and its endpoints. Whether and when to include a service module is discussed below. In the generated API document web page, this route module's name appears on the left panel, and to the right all of its endpoints are listed.

### Examples of API endpoint naming
The endpoints for a Resource are typically designated by different verbs:

* GET /ResourceName - to get a list of the resource records
* GET /ResourceName/:id - to get a specific resource record
* POST /ResourceName - to create a record
* PUT /ResourceName/:id - to update one specific record
* DEL /ResourceName/:id - to remove (or mark as such) one specific record

This can cause some issues. Blueprint.Node development over time has found that mobile client networking libraries and frameworks prefer to have unique endpoint paths (also they prefer 200 for all success responses in some libs). The use of a single PUT endpoint on a resource to update any attribute is an anti-pattern - it does not indicate intent, and makes business invariants hard to implement. You might be in a better place with the idea of 'commands' which replaces the generic path for PUT to contain more specific paths that indicate intent. Going this route allows you to restrict each intent with different roles, gives better granularity in LAMD logs and metrics, and will allow you to code specific invariant logic per intent. This is also a best practice for domain driven design.

* PUT /ResourceName/:id/_done - Mark the record as 'done'
* DEL /ResourceName/:id/_remove - to remove (or mark as such) one specific record

Note also that the `Route` service that loads route modules will always add a POST verb to any PUT or DEL verb, so it is important to make your endpoint paths unique with respect to other PUT, DEL and POST endpoints.

## Route level topics
The following topics are not specific to endpoint logic, but apply either outside endpoint logic, or is generic to all endpoint logic

### Static deps()
Typically modules depend on each other and Blueprint.Node has a place to declare these, to ensure you needs are met and modules load first for those you depend on. In your class you declare a static method that returns the 3 kinds of dependencies. Note, a route module is never a dependency, therefor it must be loaded in your `src/app.js` `route_modules` list. Notice below the 'S' 'P' and 'myRoute' references ...

    class YOUR-ROUTE-NAME {
        static deps() {
            return {
                services: [ 'S'],
                psql_mods: [ 'P'],
                config: 'myRoute{a,b}',
            }
        }
        constructor(kit){
            this.S= kit.services.S
            this.sdb= kit.services.db.psql
            this.config= this.services.config.myRoute

            this.endpoints={
                ...
            }
        }
        service_init(kit){
            this.S.serviceMethod()
        }
        getEndpoint(ctx,preLoad){
            dbRows= await this.sdb.P.read(ctx, ctx.p.id)
        }
    }

More details on this structure is given in [SERVICE_MODULES.md](SERVICE_MODULES.md).

### How to leverage the wrapper with annotations
In your constructor you define `this.endpoints` for the wrapper service to know how to prepare for your endpoint logic. This structure has a number of attributes as described below.
#### verb: 'get'
Should be all lower case. Can be 'get', 'put', 'del', or 'post'. When 'del' or 'put' are given, a 'post' will also be added, so you need to make the `route:` value unique for 'post', 'put' and 'del'.
#### route: '/User/:usid'
This is the string used to match the inbound URL with your route. This is the same in Restify as in Express and many other servers. The wrapper will perpend this string with "/api/:Version" to that clients will need to send '/api/v1/User/204` to match your '/User/:usid' endpoint.
#### use: true
Used to create the API Documentation web page. When users navigate to /api/v1 the API server generates a web page of the `route modules` and specific information on each `endpoint`. When this attribute is an object, it is used as the documentation information, when it is `false` the endpoint remains hidden, and when `true` it means your endpoint logic will return the documentation object when it is called with the string value 'use' in the `ctx` parameter. See below on what this object looks like. The value of setting this attribute to `true` and putting the documentation object into your endpoint, is that it places your documentation closer to your implementation, to help keep it in sync.
#### wrap: 'default_wrap'
There are 3 primary wrapper methods, and you could customize your own. The typical one is `default_wrap` that we have been talking about. There is `auth_wrap` for authentication endpoints which create a DB connection automatically and requires some OAuth specific parameters. See the wrapper service code for more details. The other one is `simple_wrap` which does not implement any annotations other than `auth_required`, `version` and `use`, and does not create a `ctx` (you are called with the traditional (req, res, next)). You must call res.send() and next() yourself.
#### version: {any: this.getUserRoute, v1: this.getOldUserRoute}
For endpoint logic versioning, you can assign specific methods to specific requested versions of this endpoint. As stated above for the `route` attribute, an `/api/:Version` string is pretended to your route string. Client requests actually contain this prefix to your route string. The `:Version` value is used to match your HASH values here. If none match exactly, then `any` is used (you typically always include this one.)
#### sql_conn: true
When `true` a DB handle will be acquired from the pool before you are called. The wrapper will take care of returning it to the pool and/or destroying it if there are issues with the handle. The wrapper also checks for sane values in the connection handle attributes, and will error if e.g. you return a handle while it is still processing a DB request (you forgot to put `await` on a call maybe).
#### sql_tx: true
When `true` a read-isolation level transaction will be started on the DB handle. You must also have set `sql_conn: true`. The wrapper will worry about commit/rollback.
#### auth_required: true
When `true` an OAuth token will be expected by the client, and resulting values populated in the `ctx` for your endpoint logic.
#### pre_load: { HASH: method}
When you wish to run a common method before the endpoint logic. See examples below.
#### is_websock: false
Used on endpoints that map to a web socket implementation. When `true` results in the wrapper not calling req.send() to end the connection.
#### lamd: true
When set to `false`, a LAMD endpoint record will not be recorded. Used by the health-check to avoid massive amounts of the same record - such as with AWS EB/ALB healthchecks. Using `false` can be an issue with HIPAA if the endpoint must be audited.

#### roles: []
An array of strings. The wrapper expects the OAuth token roles list of a user to have at least one of the roles you specify for this endpoint.
#### domain: ''
Require the OAuth access_token to have a domain value that matches

    if (endpoint.domain) {
        if (req.auth.token.domain !== endpoint.domain) {
            accessDeniedError('INVALID DOMAIN');
        }
    }
#### permit
Not-implemented fully. A planned extension to RBAC.
#### mongo_pool
Not-implemented fully. A planned way to grab a specific DB handle for mongo DB requests.

### Pre-loads (how / when to use)
Sometimes a group of endpoints will benefit by the same logic being run prior to the rest of the endpoint logic running. For example, reading a record from the DB or special authorization handling. This can be accomplished by declaring a method in the class, and adding that method to the `this.endpoints` annotations for any or all of your endpoints. The results from that method will go into a preLoad param that is passed to your endpoint logic. As with endpoint logic, you can throw an error in this preLoad method to abort further handling of the request.

##### src/r_fruit.js constructor

			// Fruit Endpoints
			this.endpoints = {
                ...
				eatFruit: {
					verb: 'del',
					route: '/Fruit/:frid/eat',
					use: true,
					wrap: 'default_wrap',
					version: { any: this.eatFruit.bind(this) }
                    pre_load: {
                        fruit: this.preLoadFruit.bind( this),   <--------------- Here
                    }
				},

##### src/r_fruit.js method defined later in this route class

	// Preload the Fruit
	// Assumes 'Fruit/:frid' in the URL
	preLoadFruit(ctx, preLoaded){
		const f= 'Fruit:preLoadFruit:'
		const {fruitId: frid}= ctx.p
		let dbRows

		// Grab the Fruit from the database
		dbRows= await this.sdb.fruit.getById( ctx, fruitId)
		if (dbRows.length!== 1)	throw new this.E.NotFoundError( 'PRELOAD:FRUIT')

		return dbRows[0] // Wrapper places this result in the hash provided by this.endpoints
    }
##### src/r_fruit.js endpoint logic has this result

	eatFruit(ctx, preLoaded){ // Or (ctx, {fruit})
		...
		const {fruit}= preLoaded
		...
	}

### server_init usage
You can include a method called server_init which is called once before endpoints start taking requests, for any start up logic that could not be done in the constructor. It is best to keep constructors light. Here is an example from r_health ...

	server_init(){
		// ServiceHealth
		Object.keys( this.all_services).forEach( nm => {
			if( typeof this.all_services[ nm].HealthCheck=== 'function') {
                this.services[ nm]= this.all_services[ nm];
            }
		});
	}

### Use of the config file
Endpoints may wish to use a config entry. It is exposed from the constructor with kit.services.config[ YOUR KEY] just as it is for servces (see [SERVICE_MODULES.md](SERVICE_MODULES.md)). An example from r_health where an endpoint is implementing a custom authorization using a shared secret ...

        constructor(kit) {
            ...
            this.config= kit.services.config.health; // Expect a 'health' key for our route module
        }

        // Same as GetLogs but forces type=pingComprehensive and checks URL based security
        _GetLogs_HCProxy(ctx, pre_loaded){

            if (this.config.security_keys.indexOf( p.secret) === -1){
                if( p.ref) ctx.res.status( Number( p.red));
                return {send:{ success: true, final_disposition: 's'}};
            }

### Local logging with this.log when needed
When you need to log something, outside the context of a `ctx` param (such as in your constructor or service_init method) use kit.services.logger like so ...

        constructor(kit) {
    		this.log= kit.services.logger.log;
            const {one,two}= this.services.config.myConfig

            this.log.debug( f, {one,two})


## Endpoint best practices
Some of these suggestions are simply to allow us to build code that is recognizable (because we are all doing similar things in a similar way.) It is nice to go into a foreign codebase and right away recognize what his happening and why.

### How to leverage the wrapper for ctx values
Every endpoint method receives a `ctx` first parameter. This has values populated by the `wrapper` service.

#### Security related items (aut_id, role, token)
##### ctx.auth_id
The authenticated ident_id of this user. This is set for this endpoint if you annotated it with `auth_required: true`. A typical use is to allow the endpoint for e.g. GET /Profile/:id to be requested by the client as a hardcoded `GET /Profile/me` - and you would replace 'me' in your endpoint logic with the value of ctx.auth_id.
##### ctx.role
An array of roles that this user has been assigned. If there was a list of roles in your endpoint annotation, at least one of them had to exist in this list. This value is populated via the OAuth token, so it does not hit the DB and may be stale if roles changed more recently than the expiration of an access_token (typically 10 mins).
##### ctx.token
For values in the OAuth token that are not the ident_id or the role list, this object contains those values. A typical value is 'tenant' ID (which you may use to filter results in the DB in a multi-tenant architecture.) This concept (of a token object) allows us to customize what goes into the OAuth token without modifying the common wrapper service.
#### Popular items (log, p)
##### ctx.log
This is the logger for keeping log lines for a single endpoint request together. Use it like `ctx.log.debug( f, object)`.
##### ctx.p
This is the Restify req.params object. It contains a hash of all your inbound params. These will be the combined values from URL placeholders (i.e. /api/:Version/ResourceName/:id invoked with /api/v1/Resourcename/12 yields {Version: 'v1', id: '12'}) the URL querystring, and POSTed values as form-data or as JSON. Note that without JSON, these values will always be strings. When uploading files, see `ctx.files` below.

You cannot trust these values, since they come from POSTed data from a client. It is best to pull the hash values you wish to use, and validate both the type of value, and make your own copy of the results of your processing (i.e. Don't mutate this object, and don't pass it to other non-route aware methods.) const p= ctx.p` is just a reference to the same object, so copy what you want from here ...

    const use_doc={
        params: {
            a: 'number - default 0',
            b: 'number - required, > 0',
            c: 'string - required, len>= 0',
        }
    }
    if (ctx=== 'use') return use_doc
    const f= 'MyClass:myEndpoint:'
    var dbResult
    
    const p= ctx.p
    const newVals= { a: 0}
    for let nm in ['a','b','c']{
        if (p[nm] == null) {
            // Check for default, else required
            if (newVals[nm] == null) {
                throw new this.E.MissingArg(f+nm)
            }
        } else {
            newVals[ nm]= (nm=== 'c'? p[nm]: Number p[nm])
        }
        let valid= true
        if ( nm=== 'c') valid= typeof newVals[ nm] === 'string'
        else if (nm=== 'b') valid= newVals[ nm]> 0
        if (!valid) throw new this.E.InvalidArg( f+ nm)
    }

    // Use newVals which contains only a,b,c with correct type and validated (possibly default values)
    dbResult= await this.sdb.mypsql.update( ctx, newVals)


#### Obscure items if needed (files, spec, req, res, conn)
##### ctx.files
The value of req.files which is populated by Restify for file uploads, which is written to disk. This is not recommended to use, since it tends to violate the 12factor app principle.
##### ctx.spec
A copy of your endpoint's annotations - i.e. this.endpoints[ ENDPOINT-NAME]; Could be used if you have the same method implementing multiple endpoints.
##### ctx.req
The Restify request structure, if needed.
##### ctx.res
The Restify response structure. Sometimes used when not doing strictly REST JSON responses.
##### ctx.conn
The DB connection handle if requested in your endpoint annotations. Normally the whole `ctx` object is simply passed down to the SQL layer.


### When/how to use services modules
Many times your route module and a related psql module will encapsulate a Resource and all of the logic and persistance, and therefor will not require additional abstraction. However, if the work you are doing in an endpoint, requires coordination with other logic outside your route module, that logic is best placed into a service module. Then other route modules and other services as well as the RunQueue can utilize this common abstracted logic.
You declare your need for a service with `static deps() { return services: [ 'SERVICE-NAME-HERE]}` and in your `constructor(kit)` set `this.SERVICE= kit.services.SERVICE-NAME-HERE` - then you call the methods of the service via `this.SERVICE.METHOD-NAME-HERE`

### The idea of putting security checks here, vs. lower in services or sql.
Security by obscurity is not how we want to build code - i.e. our security coding should not be obscure or hard to read and reason on. An excellent way to address this is to keep all of our security checks inside the endpoint method itself. Outside of this (in service methods and psql methods) we expose parameters that allow us to restrict the processing of that logic. For example, a tenant ID might be used to restrict what set of records a user is allowed to update. So, the psql layer can require a tenant ID in the params, and use it in the WHERE, even when a record ID is also included.
The annotations for an endpoint that support security are: `auth_required` (any OAuth user can get this far), `roles: []` at least one of these must be in one of the user's roles list from the ident table (and recorded in the access_token.)
If your logic allows e.g. `['reader','admin']` and you want to allow additional features for 'admin' - you can inspect ctx.roles to see which roles this user has.
If you wish to perform a Basic auth, or use params for e.g. JWT or shared secrets, this would need to be implemented in the endpoint at this time (not a wrapper feature) or in a pre-load method.

## DB handling best practices
You will want to place all your SQL into a psql module layer. This allows us to refactor the DB schema without much difficulty, because we can see (and change) in one place what logic is coded against a given table.
The route module declares which psql modules it depends on, and gets access to them via `kit.services.db.psql` like this ...

    class JunkRoute {
            static deps() {
                return { services: [], psql: ['junk'] }
            }
            constructor(kit) {
                this.sdb = kit.services.db.psql

            ...

            endpoint( ctx) {
                ...
                dbResult= await this.sdb.junk.delete(ctx,p.id)
            }

`sdb` stands for sql database. If we all use this var name, our endpoint logic and snippets will be cut-n-paste-able.

### DB results handling
There are generally three kinds of responses from the psql module methods that we expect (a) SELECT queries, (b) DML commands such as DELETE or UPDATE without a RETURNING clause, and (c) DML with a RETURNING clause. It works best if we always return the same shape result - for (a,c) an array of rows, (b) a response object.
(There is also a desire to allow us to move between MySQL and PostgreSQL in both the writing of SQL and the response structures - and Blueprint.Node has features for this; see [PSQL_MODULES.md](PSQL_MODULES.md))

In the endpoint logic, we should always check the response from the DB for exactly what is expected, whenever possible. This can help us with e.g. misconfigured DB schema/tables - like when an expected unique constraint is missing.

If we use common variable names for getting and checking DB methods, our code is easier to share. Here is a suggestion ...

    var dbRows, dbResult, newVals, reread

    dbRows= await this.sdb.MOD.read( ctx, id) // Expect exactly one row
    if (dbRows.length!== 1) throw new this.E.NotFoundError( f, 'MOD.read:'+ dbRows.length) // Include length to ease misconfiguration debugging
    send.object= dbRows[ 0]

    dbResult= await this.sdb.Mod.deleteMany( ctx, ids)
    // Not idempotent (or we checked for existence above), expect this row to be removed
    if (dbResult.affectedRows!== ids.length) throw new this.E.DbError( f+ 'MOD.deleteMany:'+ dbResult.affectedRows)

    newVals= _.pick( ctx.p, [ 'a', 'b', 'c'])
    dbRows= await this.sdb.MOD.updateOne( ctx, id, newVals, reread= true)
    if (dbRows.length!== 1) throw new this.E.DbError( f+ 'MOD.updateOne:'+ dbRows.length) // Mostly copied from above
    send.newObj= dbRows[ 0]

### How read-isolation works with transactions for endpoint support; what the wrapper does for us (commit/rollback) (Maybe discussion of DeadLocks too?)
We use read-isolation to make DB programming easy for everyone while keeping the DB state 'safe.' Once the DB state is incorrect there is almost nothing to fix it, when it occurs as incorrect logic. This method means that any SELECT (read) operations during a transaction on a given connection, will be guaranteed to be unchanged when making DML statements (i.e. DELETE or UPATATE.) You can safely read a value, and then make changes based on that value, knowing it has not changed (i.e. read qty as 10, and write it back as 9, is safe.) When the DB detects that your reads have been changed in the DB before you commit, a DEADLOCK error will occur when you make a DB call. The LAMD logging and health check monitoring system is designed to surface this condition so that it can be addressed. The rollback will keep the DB state safe, but you may have to start doing more involved locking commands to avoid these DEADLOCKS in the future.

## Endpoint logic
### Self documenting endpoints - how it works, options to support it in your endpoint; how some use it for validation to keep it relevant
When you annotate your endpoint with `use: true` then the `Route` service which loads your route module, will call your endpoint to acquire a "documentation object" which is then used to create the API documentation web page at the URL `/api/v1`. Your endpoint should look for `ctx === 'use'` and return an object such as ...

    const use_doc= {
        params: {
            p1: 'description',
            p2: 'description',
        }
        response: {
            success: 'bool',
            User: '{Object}', // For example
            Boats: '[Array]',
        }
    }
    if (ctx=== 'use') return use_doc

You are welcome to put anything into the text values that help users of your API to use it properly.

### Use of 'error' objects (when to call which ones, etc.) -  needs work to make error objects easier to use
Blueprint.Node provides a set of error types that are common. They are designed to help work backwards to where issues occur. Note: This part of the API server is old and not working well and needs attention. It would be better if the signature is consistant. Sometimes only one value is taken (a code or message) and sometimes both.
Here is one of each error available. These methods can be accessed via `error` as a service i.e. `this.E= kit.services.error` ...

    throw this.E.NotFoundError( 'code') - Sends a 404
    throw this.E.ServerControlledException( old_code, title, text, commands, goto) - 420
    InvalidArg( message) - 400
    MissingArg( message) - 400
    NotFoundError( token, message) - 404 (token param ignored)
    OAuthError( code, error, message) - 401 (code param is ignored)
    BasicAuthError( error, message) - 401 (err.code is error, err.message is message)
    AccessDenied( token, message) - 403 (err.code is token, err.message is messagse)
    DbError( token) - 500
    ServerError( token, message) - 500
    MongoDbError( message) - 500
    TooManyConnectionsError() - 426 (used by the wrapper to tell load balancers - did not work as hopped)

### Why you can just throw an error when something is wrong (more wrapper/LAMD support)
The wrapper calls your endpoint logic inside of a promise, and will `catch` any errors. In this case, if you have `sql_tx: true` the transaction will be rolled back. if you have `sql_conn: true` the handle will be returned to the database pool. It is almost never required to catch any errors in your logic. Any errors will then be place into the LAMD object and recorded for health check monitoring, and the client will receive the non-200 status and error response object.

### Returning a response (the 'send' hash and other options 'testability' 'audit?' etc.)
The wrapper expects your endpoint to return an object with a HASH of `send` that contains what should be handed to res.send(). It expects it to be an object, and will set a `.req_uuid` value on this object for the client response to trace back to LAMD logs. (this is done also in error objects.) You can also set other HASH values for other purposes, such as `.testability` that can be validated by automated testing, and left in place in production without affecting the send results.
A planned feature is to add a HASH of `.audit` to record which records were accessed in a GET request (populate a list of `table-name: [ids...]`).

### Best pattern for 'send' object initialization, setting, and final return (include concept of success:true)
When client developers use the Blueprint.Node API server, we want a consitent response shape, to allow mobile and web clients to work well, and share code between projects. One feature of the response object is to always include `success: true` for a positive way to ensure the result is good, vs. just using a statusCode. To simplify the endpoint logic, then, here is a good pattern to follow ...

    const use_doc={
        response: {
            success: true,
            User: '{Object}',
        }
    }
    // Put this var close to use_doc to keep them in sync
    const send= { success: true, User: false} // indicate what the return signature looks like; indicate values that if not set by us will be obvious (use of `false`)

    ...
    send.User= dbRows[ 0]
    ...
    return {send}

### CORS config/processing and support for avoiding the pre-flight
See [CORS.md](CORS.md).

## Testing
### Note on testing - (a) bypassing restify/wrapper, (b) best to include DB layer (semi-integration or route+sql as a unit)
See [TESTING.md](TESTING.md).

Optional topics for this doc:

* Push logic (how to set up, how to use it in routes w/return handle) - won't include how clients connect to get push results
* Emails (ses service)
* Axios-wrap use
* Adding jobs to the RunQueue (when/why/how)
* Prototype feature using just a config file entry
* TripMgr service (for email links)
* S3 related endpoints (for signed upload, and signed download if needed) and how to track a reference in the DB
* Concerns with commits to 3rd party SaaS (such as Braintree charges and a subsequent error & rollback)
* Support and implementation of alternate security (i.e. Basic auth)
* Related topics from secure coding practices and our Secure Architecture inventory spreadsheet
* Use (and abuse) of JWT in endpoint logic
* Use of moment and dates in the DB (and through endpoint parameters; how to account for client timezone)
* Versioning of endpoints