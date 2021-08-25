# Observability
LAMD (Logging, Auditing, Monitoring, Debugging) is primarily a tool to allow developers to 'observe' the running software. In our case the primary use case is a request to an endpoint, which likely calls the DB and possibly an HTTP service. LAMD is primarily an endpoint logger, and secondly it captures and groups debug log lines for a given request.

## Endpoint log object
Each time an endpoint request is completed, LAMD persists an object of details to a jsonb field in the DB. There is a variety of information in the object for sorting, filtering, metrics, error detection, alarming, timing and correlation. Here are a list of the attributes to expect:

    {
    start: 1629392006287,
    date: '2021-08-19T16:53:26.287Z',
    route: '/Junk',
    verb: 'get',
    req_uuid: '46ad8edf-dbdd-4ed6-8240-807a22f96f2a',
    auth_id: 0,
    params: { Version: 'v1' },
    headers: {
        host: 'localhost:9500',
        connection: 'keep-alive',
        'cache-control': 'max-age=0',
        'upgrade-insecure-requests': '1',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'accept-language': 'en-US,en;q=0.9',
    },
    conn_id: 102,
    request_count: 1,
    request_count_high: 1,
    statusCode: 200,
    duration: 10
    }

A few of these fields are obvious: date, statusCode, route, verb, param, headers. If the statusCode was not 200, you might also see an error object with the details about the reason for the exception. A few less obvious fields:

    start: Timestamp in ms of the start of this request. Request ended at start+duration. Sort for granular ordering.
    req_uuid: Global unique value assigned to each endpoint. Is used to tie all debug log lines together.
    auth_id: 0 means not authenticated, otherwise it is the ident_id of the authenticated user
    conn_id: A unique value on the DB connection handle (if requested); used to correlate issues with other endpoints.
    request_count: How many accepted but not completed endpoint requests are being handled, including this one.
    request_count_high: All time high water mark for request_count since the server was started.
    duration: Number of ms this request took from when it first was seen by the wrapper, until the response was ready to send.

Here is a example of a LAMD object that contains an error result:

    {
    start: 1629391817147,
    date: '2021-08-19T16:50:17.147Z',
    route: '/Junk/:id/remove',
    verb: 'del',
    req_uuid: 'f09a79f1-87c4-44ba-a567-c16dc3526a74',
    auth_id: 0,
    params: { Version: 'v1', id: '4' },
    headers: {
        host: 'localhost:9500',
        'user-agent': 'curl/7.64.1',
        accept: '*/*'
    },
    conn_id: 101,
    request_count: 1,
    request_count_high: 1,
    statusCode: 5550,
    duration: 14,
    err: {
        name: 'TypeError',
        message: 'this.db.junk.removeItem is not a function',
        stack: 'TypeError: this.db.junk.removeItem is not a function\n' +
        '    at JunkRoute.S_RemoveJunk (/Users/james.shelby/Clients/SampleProjects/my_app3/src/r_junk.js:65:40)\n' +
        '    at Wrapper.<anonymous> (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/blueprint/lib/wrapper.js:340:5)\n' +
        '    at Wrapper.tryCatcher (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/util.js:16:23)\n' +
        '    at Promise._settlePromiseFromHandler (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/promise.js:547:31)\n' +
        '    at Promise._settlePromise (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/promise.js:604:18)\n' +
        '    at Promise._settlePromise0 (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/promise.js:649:10)\n' +
        '    at Promise._settlePromises (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/promise.js:729:18)\n' +
        '    at _drainQueueStep (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/async.js:93:12)\n' +
        '    at _drainQueue (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/async.js:86:9)\n' +
        '    at Async._drainQueues (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/async.js:102:5)\n' +
        '    at Immediate.Async.drainQueues (/Users/james.shelby/Clients/SampleProjects/my_app3/node_modules/bluebird/js/release/async.js:15:14)\n' +
        '    at processImmediate (node:internal/timers:464:21)'
    }
    }

The statusCode 5550 is a special value from the wrapper to indicate an uncaught error. The LAMD object tries to add information to the error object that helps developers, although these details are not also sent to the client in the response. Certain common errors (such as 400 and 404) do not include that stack in the error, per wrapper logic.

To get more details on this object, or to add to it, see the wrapper service for your project.

## Log lines
In addition to the LAMD object per endpoint request, there is also a table holding individual log lines recorded during the endpoint request processing of the business logic. In your own modules / methods / functions you are typically going to have a `ctx` value passed. This object contains what is needed to tie all our log lines together to the same req_uuid value. It has a log function in it, with a specific signature of (string, object) - normally the string is the name of your method possibly augmented with an additional string value when you have a deeper log line to identify. The concept of this first parameter is to make it easy to work backwards into the code to know where this log line was called. Here is a simple pattern:

class Interesting {
    whatever( ctx, paramA, paramB) {
        const f= 'Interesting:whatever:'

        ctx.log.debug( f, {paramA, paramB}
        )
        ...
        // About to do some involved logic based on 3 vars a, b, c
        ctx.log.debug( f+ 'involved', {a, b, c})
        ...
        var returnValue= 0
        ctx.log.debug( f+ 'final', {returnValue})
        return returnValue;
    }    
}

### Bulit-in log lines
There are several places where logging is built into a lower layer module - think of this before you log, to avoid redundancy and duplicated work.
#### SQL calls
The sql function will log the query string, the arguments, and a sampling of the response object from the DB.

    16:49:46.242Z DEBUG server: (req_id=b803ece7-a3d5-42a6-acfc-59e6d47bff56)
        PostgreSqlCore:sqlQuery:-100-:PSQL:0 SELECT id,item
        FROM junk
        WHERE di= 0

    16:49:46.286Z DEBUG server: (req_id=b803ece7-a3d5-42a6-acfc-59e6d47bff56)
        PostgreSqlCore:sqlQuery:-100-: {
        command: 'SELECT',
        rowCount: 5,
        rows: [ { id: 1, item: 'kitchen sink' }, { id: 2, item: 'kitchen sink' } ],
        time_ms: 44
        }

This example shows on the first line that the class+method is PostgreSqlCore:sqlQuery, the conn_id is 100, the 'PSQL' means this is the debug line showing the query string, ':0' tells us the argument list is empty (hence no additional debug line showing args.)

The second line in this example shows the DB result structure, however the 'rows' array has been trimmed back from the actual 5 rows result.

#### HTTP requests
If you use the Axios wrapper [lib/axios_wrap.js](lib/axios_wrap.js), it will add interceptor functions to capture anything that might go wrong with the request. It logs the outbound request and response. Axios has very involved recursive structures that break code that attempts to serialize for recording debug lines, so this tool is useful.

#### Runqueue wrapper
If you use the wrapper for the runqueue service, it will also create a LAMD object for each job that is run (just as the router wrapper creates a LAMD object for each endpoint request.) More on this is mentioned in the health endpoints.

#### Summary
Even if you added no log lines to your endpoint logic, and you make one or more DB calls, you will see both a LAMD object, and details of the SQL call(s.) Placing log lines in strategic places, and passing the `ctx` object to your callers, give you the best chance of knowing what is going on in your code. Leaving these lines in for production, gives us the best chance of solving production issues. Observability is key.

# Enabling LAMD and Health checks
If nothing goes wrong, this step is pretty easy (assuming you have set up DB access with [DATASE_EXAMPLE.md](DATASE_EXAMPLE.md).) In `src/app.js` add 'lamd' to your services, 'Health' to your routes, and 'lamd' to your psql_mods. Then add the DB schema to your `db/scripts/V1__base.js` file...

    /*
    * LAMD Database Schema
    */

    CREATE TABLE lamd
    (
            id    SERIAL         PRIMARY KEY /* https://www.postgresqltutorial.com/postgresql-serial/ */
            , di    SMALLINT       DEFAULT 0 NOT NULL /* disposal - 0:none,1:disabled,2:purge*/
            , cr    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row created */
            , mo    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row modified */

            , log   jsonb          DEFAULT NULL /* JSON fields and values */
    );

    CREATE TABLE lamd_deep
    (
            id    SERIAL         PRIMARY KEY /* https://www.postgresqltutorial.com/postgresql-serial/ */
            , di    SMALLINT       DEFAULT 0 NOT NULL /* disposal - 0:none,1:disabled,2:purge*/
            , cr    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row created */
            , mo    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row modified */

            , log   jsonb          DEFAULT NULL /* JSON fields and values */
    );
    CREATE INDEX ix_lamd_deep__req_uuid ON lamd_deep USING HASH ((log->>'req_uuid'));

There is also a need to configure the health check service since it requires some alternate authentication to support automated monitoring products. As a top-level hash-key (i.e. above route_modules and as a peer of it), add this to `src/container.js` ...
        health: {
            security_keys: (process.env.HEALTH_SECURITY_KEYS || "").split(","),
        },
        route_modules: { ... }

Reset the DB and restart the server (to pick up the new route, service, and psql_mod.) You should see a new module in the API docs [http://localhost:9500/api/v1](http://localhost:9500/api/v1). Let's look at the new 'Health' endpoints. `/Ping` should work out-of-the-box, it requires no auth and no DB etc. To access the LAMD objects that tell us what has been happening with our API server endpoints, let's first create a request with a DB call. Check inventory on Junk: [http://localhost:9500/api/v1/Junk](http://localhost:9500/api/v1/Junk). Next, attempt to list the last 100 endpoint requests: [http://localhost:9500/api/v1/Logs?type=last100](http://localhost:9500/api/v1/Logs?typ=last100).

You get an authorization error, because this endpoint is protected. To allow tokens to be created on our API server, you need to have followed the [OAUTH_EXAMPLE.md](OAUTH_EXAMPLE.md). It will also require that your user has either 'dev' or 'admin' role. Let's upgrade our ident user with a 'dev' role, and then reset the DB and then use our cURL login request endpoint to acquire a token.

Upgrade 'dude' to be a 'dev' person also:

      ('dude@deviq.io', 'ACqX5b7oFXZHOozGZo809A==.wXrhYtmmqLFL8Hvr6LIo0XF+Xq1RMAhEoKF54Pw+5RA=', 'reader,dev')

Reset the DB. Next curl to get a access-token (I'm escaping chars for a shell)...

    curl http://localhost:9500/api/v1/Auth\?client_id=whatever\&username=dude\@deviq.io\&password=password\&grant_type=password

Grab that access_token value, and go back to your browser for last100, and add &auth_token=YOUR-TOKEN - this uses the wrapper feature of an alternate way to provide a token without using the 'Authorization' header.

The results you see have limited values in the LAMD object showing. This is partly due to attempting to protect data by not showing everything here. On any of these objects, you can take the req_uuid and get all the details of that object and all the debug lines that go with it. Copy the req_uuid value from the /Junk endpoint and open a tab using:

    http://localhost:9500/api/v1/Debug/THE-REQ-UUID?auth_token=YOUR-TOKEN

## Auotmated health check monitoring
To support the need for an outside SaaS to monitor the health of our API server instances and alerts when endpoints return unexpected errors to our clients, we have the endpoint [http://localhost:9500/api/v1/Logs/pingComprehenseive](http://localhost:9500/api/v1/Logs/pingComprehenseive). When you go to this endpoint, you get a response with an 's' (which is an obscure reference to the need for a security failure.)

### Security
You will need to add to this URL a `?secret=` to allow access to this endpoint. This is a security check method that is directly built into the endpoint logic. It allows us to use SaaS products without paying extra money for OAuth or other header based authentication. You will notice earlier we added a `health:` key to our `src/container.js` and there is a reference to process.env.HEALTH_SECURITY_KEYS. If we leave it empty, then the above secret= with no value should work. To protect this endpoint, add to your environment a comma separated list of keys (or even just one string key without a comma) to require one of these values on this url.

### Attributes
Ping-comprehensive combines several health check endpoint type requests together, and determines an alert level of r, y, or g (red, yellow, or green.) It also attempts to check the Runqueue service health. The various parameters that can be used on this endpoint are documented in the route module `r_health`. An example of an endpoint that is being used to check our DevIQ Connect service, is ...

    https://api-stage.deviq.video/api/v1/Logs/pingComprehensive
        ?red=599
        &yellow=598
        &epoch_secs=120
        &yellow_250ms=2
        &red_250ms=3
        &endpoint_baselines=post/TwilioRoomHook,35;post/Twilio/_make_token,6
        &secret=James6325

... and the output looks like ...

    {
        "subject": "Ping Comprehensive (Errors, perf, deadlocks, services) Aggregations of API",
        "final_disposition": "g",
        "date": "2021-08-25 19:53:55",
        "now": "2021-08-25 19:53:55",
        "time_ms": 55,
        "results": [
            {
                "success": true,
                "note": "no-note",
                "subject": "Errors (unexpected) Aggregations of API",
                "date": "2021-08-25T19:53:55.646Z",
                "num_results": 0,
                "results": [ ],
                "time_ms": 20,
                "do_email": false
            },
            {
                "success": true,
                "note": "duration > 500ms",
                "subject": "Hourly Performance Aggregations of API",
                "date": "2021-08-25T19:53:55.666Z",
                "num_results": 0,
                "results": [ ],
                "time_ms": 20,
                "do_email": false
                },
            {
                "success": true,
                "note": "no-note",
                "subject": "API Deadlocks",
                "date": "2021-08-25T19:53:55.681Z",
                "num_results": 0,
                "results": [ ],
                "time_ms": 15,
                "do_email": false
            }
        ],
        "req_uuid": "4c4f1d18-2533-49a1-9bf4-64747182f6f1"
    }

Again, a lot of details will be missing, including req_uuid values on objects because this is an aggregate (or group by) query that counts exception types. The `subject` indicates the type of query. `final_disposition` is the overall monitoring result status. 


