# Bringing up OAuth authentication

## Blueprint.Node as AAA server
AAA stands for Authentication (who is this), Authorization (who can do what), and Accounting (who did or saw what.) Blueprint.Node supports all three activities. We will see how to bring up the authentication features and then discuss how to invoke authorization features and then the support for accounting. We will take a different approach this time, of trying to use features that have not yet been turned on. We'll see how error messages can be used to understand how we might be misconfigured or need to add some of our own implementation.

## OAuth 2.0 concepts in Blueprint.Node
One big advantage of OAuth 2.0 is the use of a token to protect endpoints. This method allows us to quickly validate a user without consuming resources (such as a DB connection.) It also defines a method to validate a password without having to store that password in plain text, or easily allow someone who compromises the DB to discover those passwords. It also addresses replay attacks and session hijacking by using the access-token + refresh-token method while avoiding use of cookies and avoiding placing credentials into the URL. Blueprint.Node has token signing and expiration, one-time refresh token logic, and one-way salted hash storage of passwords. Addtionally, the access-token contains both identity information (unique user id) as well as placeholders for tenant-id and role-list to support multitenancy and RBAC (role based access control) when needed.

## Let's break something
Building off of the previous [DATABASE_EXAMPLE.md](DATABASE_EXAMPLE.md) module db/r_junk.js, let's add a single annotation value (auth_required: true) to each endpoint  specifcation (this.endpoints) in our constructor ...

        // Junk Endpoints
        this.endpoints = {
            getJunk: {
                ...
                sql_conn: true,
                auth_required: true,  <-- ADD THIS LINE
            },
            removeJunk: {
                ...
                sql_tx: true,
                auth_required: true,  <-- AND THIS LINE
            }
        }

If we now start the server, and attempt to access the GET endpoint here [http://localhost:9500/api/v1/Junk](http://localhost:9500/api/v1/Junk) we get no response in the browser (this misconfiguration is fatal) we find that we have hit logic in our wrapper (because our endpoint has auth_required: true) that is missing some required modules. Check your server standard output to see this error:

    unhandledRejection: {
    reason: TypeError: Cannot read property 'authorize' of undefined
        at Wrapper.default (/Users/james.shelby/Clients/SampleProjects/my_app/node_modules/blueprint/lib/wrapper.js:280:33)

and that line in Blueprint.Node's lib/wrapper.js looks like...

    // Authorize calls res.send so don't put this logic inside promise change where we try to 'send' on error
    const auth = await req.auth.authorize(ctx)

With JavaScript this `property of undefined` error is super common. It means that `req.auth` is null. How is this populated? The OAuth logic in Blueprint.Node is not laid out as straight forward as other parts of the system. As it turns out, this object is attached to a `req` by a `server.use` middleware strategy which is common for Restify and Express servers. For now, suffice to say that the 'auth' service supplies this object, so we need to add that service to what we load in our main application start up. Update src/app.js with this service reference...

    const services = ['db', 'auth']

(As a side note, you might wonder why the wrapper service did not just declare 'auth' as a dependancy in the static deps() method? This is so that applications that don't want to use OAuth can operate without all the dependancies that come along with it - so we add the 'auth' service manually when we want it.)

Restart the server, and even before you can retry that endpoint again we get an exception...

    UncaughtException: Cannot read property 'pwd_col' of undefined
    TypeError: Cannot read property 'pwd_col' of undefined
        at new Auth (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/blueprint/lib/auth.js:37:32)

and that line looks like ...

    this.sdb=     kit.services.db.psql;
    this.pwd_col=   this.sdb.auth.pwd_col;   <-- HERE

Again the `propery of undefined` tells us that this.sdb.auth does not exist. How do we get 'auth' inside of 'this.sdb' (which comes from kit.services.db.psql?) These are our psql_mods. And again you might wonder why this service did not just declare a dependancy on the 'auth' psql_mod in static deps()? Actually it does, but Blueprint.Node does not yet load database dependancies automatically - someone should add that for us (see the method update_deps in /index.js) So, for now we load those oursevles explicitly in src/app.js ...

    const psql_mods = ['junk', 'auth']

Start the server, and try the endpoint again, and now when we reload the inventory tab, we get this access error, becauase we did not set the `authorization` header at all ...

    < HTTP/1.1 401 Unauthorized
    < WWW-Authenticate: Bearer realm="blueprint"
    < Content-Type: application/json

    {"code":"invalid_token","message":"Missing or invalid authorization header"}

We can try again with POSTMAN or curl with at least an access token looking `Authorization` header...

    curl http://localhost:9500/api/v1/Junk -H 'Authorization: something.that.might.look.like.a.token.maybe'

We get an odd error (because OAuth tokens have 'Bearer ' before the token value, so the server attempted 'Basic' auth instead) ...

    {"code":"InvalidHeader","message":"BasicAuth content is invalid."}

Try again with 'Bearer '+ token ...

    curl http://localhost:9500/api/v1/Junk -H 'Authorization: Bearer something.that.might.look.like.a.token.maybe'

    {"code":"invalid_token","message":"Bad Signature"}

We are getting closer. Tokens are signed by the server and contain a timestamp for expiration. At this point, we really need a token from the server that we can use in our endpoints. For this we need an endpoint from a route module that gives OAuth 2.0 type authentication for us. We have that, let's add the route module supplied by Blueprint.Node called 'Auth' to the src/app.js's routes-to-be-enabled:

    const routes = ['FruitRoute', 'JunkRoute', 'Auth']

Restart. Let's now look at our API documentation to see these new endpoints and how we might use them [http://localhost:9500/api/v1](http://localhost:9500/api/v1) - click on 'Auth' on the left side, and click on any specific endpoint that looks interesting (maybe POST /Auth ??)...

    Auth Routes

    POST /Auth
        Params:
            client_id r:S
            username r:S
            password r:S
            grant_type r:S
        Response:
            access_token : 'string'
            token_type : 'string'
            expires_in : 'number - seconds'
            refresh_token : 'string'

Let's curl to that (I'm escaping chars for a shell)...

    curl http://localhost:9500/api/v1/Auth\?client_id=whatever\&username=dude\@deviq.io\&password=password\&grant_type=password

A few things can go wrong here, let's break it down...

    {"code":"BadRequest","message":"Api request did not match your route + method (extra slash?)"}
    
This is due to not using -X POST, try again with -X POST ...

    {"code":"error","message":"database \"blueprint\" does not exist","req_uuid":"..."}

The default DB name is 'blueprint' if you don't specify one. You likley started the server without a DBNAME ENV var.

For VSCode you might want to update your launch configuration with e.g.

    "env": {
        "DBHOST": "localhost",
        "DBNAME": "local_yourapp_yourname",
    }

The error we are looking for is this one...

    {"code":"error","message":"relation \"ident\" does not exist","req_uuid":"..."}

... and this is reasonable, since we did not yet add that table to our schema files. This schema definition is in [db/schema_auth.sql](db/schema_auth.sql) (TODO convert from mysql to psql) - add this to db/scripts/V1__base.psql ...

    /* Schema for Authentication Tables
    DB Schema:
            ident: Authentication Table
            refresh_tokens: Authentication Token Table
    */

    CREATE TABLE ident (
          id    SERIAL         PRIMARY KEY /* https://www.postgresqltutorial.com/postgresql-serial/ */
        , di    SMALLINT       DEFAULT 0 NOT NULL /* disposal - 0:none,1:disabled,2:purge*/
        , cr    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row created */
        , mo    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row modified */

        /* Credentials*/
        , eml    VARCHAR( 128) UNIQUE DEFAULT NULL /* 'email' */
        , pwd    VARCHAR( 128) DEFAULT NULL /* 'password' */

        /* Additional info encoded into access token */
        , tenant  VARCHAR( 128) DEFAULT NULL /* tenant reference (optional) */
        , role    VARCHAR( 128) DEFAULT NULL /* role string (optional) */
    );

    /* Then insert some recs for system identities: */
    INSERT INTO ident (id,eml) VALUES
          ( 99, 'SYSTEM - TIMERS')
        , ( 98, 'SYSTEM - API')
        , ( 97, 'SYSTEM - TEST')
        /* Additional System Idents descend from here */
        ;

    ALTER SEQUENCE ident_id_seq RESTART WITH 100;

    CREATE TABLE ident_tokens (
          id    SERIAL         PRIMARY KEY /* https://www.postgresqltutorial.com/postgresql-serial/ */
        , di    SMALLINT       DEFAULT 0 NOT NULL /* disposal - 0:none,1:disabled,2:purge*/
        , cr    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row created */
        , mo    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row modified */

        , ident_id    INT            NOT NULL

        , exp         TIMESTAMP(0)   NOT NULL
        , client      VARCHAR(  32 )
        , token       VARCHAR(  32 ) NOT NULL
    );

    CREATE UNIQUE INDEX ix_ident_tokens_token ON ident_tokens(token);

With this change we'll need to reset our DB ...

    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql

... and try that curl again.
TODO FIX psql_auth.js BY REMOVING "org" COL REFERENCE

    {"code":"invalid_client","req_uuid":"..."} - This is the generic error for all things OAuth finds invalid

This is acceptable, because we actually don't exist in the DB (i.e. our username is not valid.) Let's add ourselves using the sample_data_a.psql file ...

    INSERT INTO ident (eml,pwd,role) VALUES
      ('dude@deviq.io', 'ACqX5b7oFXZHOozGZo809A==.wXrhYtmmqLFL8Hvr6LIo0XF+Xq1RMAhEoKF54Pw+5RA=', 'reader')
    , ('person@deviq.io', 'ACqX5b7oFXZHOozGZo809A==.wXrhYtmmqLFL8Hvr6LIo0XF+Xq1RMAhEoKF54Pw+5RA=', 'reader,updater')

... and reset the DB, and curl again ...

    {"code":"TypeError","message":"Cannot read property 'UpdateActiveToken' of undefined","req_uuid":"..."}

This error is not too helpful, when looking at the client API response. This is because we don't want to expose too much of the insides of our application to clients. However, as developers we need more detail to work this out. The logging output of the server, under the LAMD response object of 'err', shows a stack trace of ...


    stack:'TypeError: Cannot read property 'UpdateActiveToken' of undefined\n    at AuthRoute.<anonymous>
     (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/blueprint/routes/r_auth.js:162:26)

... and this line in the source is ...

    return this.sdb.token.UpdateActiveToken(ctx, nv, current_token);}).then(function(ident_token){

... which is another simple solution when we see that this.sdb.token is missing; we add 'token' to the psql_mods array in src/app.js...

    const psql_mods = ['junk', 'auth', 'token']

... resetart the server, curl again, and viola ...

    {
        "access_token":"eyJpaWQiOjEwMCwiaXJvbGUiOiJyZWFkZXIiLCJleHAiOjE2Mjk0MTQzNzR9.8pWe0PKXhePkwXJ3QqgWFawFQA9XZ45kreiong5TGrU",
        "token_type":"bearer",
        "expires_in":600,
        "refresh_token":"Hn1Q7EFzsuJLpC6_pR9loQ",
        "info":{"iid":100,"irole":"reader","exp":1629414374},
        "req_uuid":"..."
    }

## Wow!
Did that surprise you? The encrypted password we added in the sample data equates to 'password' and now we have our access_token for API requests, which when it expires (preferably before it expires) we use the refresh_token to get a new access_token/refresh_token pair. The value `expires_in` is there to help you plan for that eventuality. Let's use our refresh_token and get a new pair ...

    curl http://localhost:9500/api/v1/Auth\?client_id=whatever\&refresh_token=Hn1Q7EFzsuJLpC6_pR9loQ\&grant_type=refresh_token -X POST

and we expect ...

    {
        "access_token":"eyJpaWQiOjEwMCwiaXJvbGUiOiJyZWFkZXIiLCJleHAiOjE2Mjk0MTQ3Njl9.zemqSXvs_cznxQKTmv528FJtv-vO44zklTBfA9VlzZw",
        "token_type":"bearer",
        "expires_in":600,
        "refresh_token":"BxmLhzUM_cVfx3dAv_uAiA","info":{"iid":100,"irole":"reader","exp":1629414769},
        "req_uuid":"07cc9a91-a224-49ce-9cf3-37bc88c25b3e"
    }

## Lets use that token

We should be able to use this token for API calls, to inventory our junk. There is an interesting short-cut to use on GET URLs that does not require use of an `Authorization` header; try this link... [http://localhost:9500/api/v1/Junk?auth_token=eyJpaWQiOjEwMCwiaXJvbGUiOiJyZWFkZXIiLCJleHAiOjE2Mjk0MTQ3Njl9.zemqSXvs_cznxQKTmv528FJtv-vO44zklTBfA9VlzZw](http://localhost:9500/api/v1/Junk?auth_token=eyJpaWQiOjEwMCwiaXJvbGUiOiJyZWFkZXIiLCJleHAiOjE2Mjk0MTQ3Njl9.zemqSXvs_cznxQKTmv528FJtv-vO44zklTBfA9VlzZw) (maybe use your own valid token) ...

## RBAC
If that worked, we might want to test some of the RBAC real quick - add this value to both endpoints in db/r_junk.js: `roles: ['updater']`, restart the server, and reload that inventory tab ...

(Note, if you get {"code": "invalid_token","message": "Token Expired"} you will need to take your latest refresh-token and curl for another 'pair')

    "code": "Wrapper:default:JunkRoute:getJunk INVALID ROLE" - This is right; we are a 'reader' and we require an 'updater'

Let's fix that now, since we want readers to be able to perform GET on that resource. Change src/r_junk.js GET endpoint `roles: ['reader','updater']` to allow both roles. Restart the server and reload that inventory tab ...

## More on Authorization
As an excersize on your own, you can do the curl to delete junk using that access_token (logged in as 'dude') which will fail the role test. However, if you log into 'person@deviq.io' then that access_token should allow you to update the inventory. It should also be able to read the inventory. It is up to you if you want that user to have only 'updater' and the GET endpoint allows both 'reader','updater' or if you want to do it the other way around - have the endpoint use single role names (i.e. GET has only 'reader' and DEL has only 'updater') and then the ident table roles would require the updater to have a reader role also, to do both.

Another question apart from RBAC - how do we restrict a user to only updating their own profile, or only if they are not also an 'Admin' role, for example? This is done in your route logic. You already restirct to a valid authenticated user, but you don't need to add a 'role' (which would restirct everyone.) Rather, you would first confirm that the endpoint request to modify a person's profile, also uses only the ident id of the currently authenticated user (ctx.auth_id is the ident table id of this authorized user) or that this user has an 'Admin' role (ctx.role is an array of this authroized user's roles from the ident table.)

Additionally, for multi-tenant implementations, you can inspect the value of ctx.token.tenant and/or use it to filter results in DB queries.

## Accounting
The wrapper creates a log entry for every endpoint request, and this log entry (LAMD object) contains the request headers and paramaters, decoded token values (auth_id, role, tenant) as well as the endpoint request being made (verb, route) and final HTTP statusCode. When the status code is 200 there is no additional response data placed into the log entry, however for non-200 responses the error information is added to the log entry. (There is an extension in another project which can place GET result IDs into the log entry for HIPAA level auditing.) (There is an extension in another project which will sanitize the serializing of the log entry using regexp to remove PHI/PII from being exposed in the logs.)

From this information is is possible to tell what anyone on the system has done, or has seen, since all actions are implemented as specific endpoints.

# Next steps
Let's take a closer look at [LAMD](LAMD.md).


