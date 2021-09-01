# Building APIs with Route modules
The REST model typically involves endpoints that are grouped around the concept of a `Resource`. Generally speaking, a route module can be used to encapsulate a Resource and its endpoints.

### Examples of API/endpoint naming
The endpoints for a Resource are typically designated by different verbs:

* GET /ResourceName - to get a list of the resource records
* GET /ResourceName/:id - to get a specific resource record
* POST /ResourceName - to create a record
* PUT /ResourceName/:id - to update one specific record
* DEL /ResourceName/:id - to remove (or mark as such) one specific record

This can cause some issues. Blueprint.Node development over time has found that mobile client networking libraries and frameworks prefer to have unique endpoint paths (also they prefer 200 for all success responses in some libs). The use of a single PUT endpoint on a resource to update any attribute is an anti-pattern - it does not indicate intent, and make business invariants hard to implement. You might be in better place with the idea of 'commands' which replaces the generic path for PUT to contain more specific paths that indicate intent. Going this route allows you to restrict each intent with different roles, gives better granularity in LAMD logs and metrics, and will allow you to code specific invariant logic per intent. This is also a best practice for domain driven design.

* PUT /ResourceName/:id/_done - Mark the record as 'done'

Note also that the `Route` service that loads route modules will always add a POST verb to any PUT or DEL verb, so it is important to make your endpoint paths unique with respect to other PUT, DEL and POST endpoints.

## Route level topics
The following topics are not specific to endpoint logic, but apply either outside endpoint logic, or is generic to all endpoints

### Static deps()
TBD
### How to leverage the wrapper with annotations
### General annotations discussion and all possible values
TBD
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
                        fruit: this.preLoadFruit.bind( this),   <-- Here
                    }
				},

##### src/r_fruit.js method defined later in this route class

	// Preload the Fruit
	// Assumes 'Fruit/:frid' in the URL
	preLoadFruit: (ctx, preLoaded)->
		const f= 'Fruit:preLoadFruit:'
		const {fruitId: frid}= ctx.p
		let dbRows

		// Grab the Fruit from the database
		dbRows= await this.sdb.fruit.getById( ctx, fruitId)
		if (dbRows.length!== 1)	throw new this.E.NotFoundError( 'PRELOAD:FRUIT')

		return dbRows[0] // Wrapper places this result in the hash provided by this.endpoints

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
This is the logger for keeping log lines for a single endpoint request together. Use it like ctx.log.debug( f, object).
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
If your logic allows e.g. 'reader,admin' and you want to allow additional features for 'admin' - you can inspect ctx.roles to see which roles this user has.
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

`sdb` stands for sql database. If we all use this var, our endpoint logic and snippets will be cut-n-paste-able.

### DB results handling
There are generally three kinds of responses from the psql module methods that we expect (a) SELECT queries, (b) DML commands such as DELETE or UPDATE without a RETURNING clause, and (c) DML with a RETURNING clause. It works best if we always return the same shape result - for (a,c) an array of rows, (b) a response object.
(There is also a desire to allow us to move between MySQL and PostgreSQL in both the writing of SQL and the response structures - and Blueprint.Node has features for this; see [PSQL_MODULES.md](PSQL_MODULES.md))

In the endpoint logic, we should always check the response from the DB for exactly what is expected, whenever possible. This can help us with e.g. misconfigured DB schema/tables - like when an expected unique constraint is missing.

If we use common variable names for getting and checking DB methods, our code is easier to share. Here is a suggestion ...

    var dbRows, dbResult, newVals, reread

    dbRows= await this.sdb.MOD.read( ctx, id) // Expect exactly one row
    if (dbRows.length!== 1) throw new this.E.DbError( f+ 'MOD.read:'+ dbRows.length)
    send.object= dbRows[ 1]

    dbResult= await this.sdb.Mod.deleteMany( ctx, ids)
    // Not idempotent (or we checked for existence above), expect this row to be removed
    if (dbResult.affectedRows!== ids.length) throw new this.E.DbError( f+ 'MOD.deleteMany:'+ dbResult.affectedRows)

    newVals= _.pick( ctx.p, [ 'a', 'b', 'c'])
    dbRows= this.sdb.MOD.updateOne( ctx, id, newVals, reread= true)
    if (dbRows.length!== 1) throw new this.E.DbError( f+ 'MOD.updateOne:'+ dbRows.length) // Mostly copied from above
    send.newObj= dbRows[ 0]

### How read-isolation works with transactions for endpoint support; what the wrapper does for us (commit/rollback) (Maybe discussion of DeadLocks too?)

### Use of generic db result vars and need to check results in endpoint logic (try to leave sql layer void of expectations, and always return same object type)

## Endpoint logic
### Self documenting endpoints - how it works, options to support it in your endpoint; how some use it for validation to keep it relevant
### Handling inbound params (don't write on ctx.p object for example; in the same way don't send ctx.p somewhere - copy what you want)
### Logging best practices (wrapper/LAMD log params; sql layer logs SQL and sometimes their own methods) best to log data before complex data manipulation logic/code
### why const f= `${className}:function:` is not desireable (i.e. quickly search and find code from LAMD logs)
### Use of 'error' objects (when to call which ones, etc.) -  needs work to make error objects easier to use
### Why you can just throw an error when something is wrong (more wrapper/LAMD support)
### Returning a response (the 'send' hash and other options 'testability' 'audit?' etc.)
### Best pattern for 'send' object initialization, setting, and final return (include concept of success:true)
### CORS config/processing and support for avoiding the pre-flight


## Testing
### Note on testing - (a) bypassing restify/wrapper, (b) best to include DB layer (semi-integration or route+sql as a unit)


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