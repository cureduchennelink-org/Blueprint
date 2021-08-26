# Observability
LAMD (Logging, Auditing, Monitoring, Debugging) is primarily a tool to allow developers to 'observe' the running software. The common use case is a request to an endpoint, which likely calls the DB and possibly an HTTP service. LAMD is firstly an endpoint logger, and secondly it captures and groups debug log lines for a given request.

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

A few of these fields are obvious: date, statusCode, route, verb, params, headers. If the statusCode was not 200, you might also see an error object with the details about the reason for the exception. A few less obvious fields:

##### start
    Timestamp in ms of the start of this request. Request ended at start+duration. Sort for granular ordering.
##### req_uuid
    Global unique value assigned by Restify to each endpoint request; Ties log lines together.
##### auth_id
    0 means not authenticated, otherwise it is the ident_id of the authenticated user
##### conn_id
    A unique value on the DB connection handle (if requested); used to correlate issues with other endpoints.
##### request_count
    How many accepted but not completed endpoint requests are being handled, including this one.
##### request_count_high
    All time high water mark for request_count since the server was started.
##### duration
    Number of ms this request took from when it first was seen by the wrapper, until the response was ready to send.

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
            const f= 'Interesting:whatever:' // e.g. class + method

            ctx.log.debug( f, {paramA, paramB})
            ...
            // About to do some involved logic based on 3 vars a, b, c
            ctx.log.debug( f+ 'involved', {a, b, c})
            ...
            var returnValue= 0
            ctx.log.debug( f+ 'final', {returnValue})
            return returnValue;
        }
    }

Just a note on where to put log lines: In this example, a method is logging its inputs and an important intermediate step, and then the final result. If this is done in a function, then you will always have the log lines regardless of when and where it is called. If instead you expect the caller to do this logging, and there are several places that this function is called, the caller may not reliably log inputs/outputs and cannot log the intermediate portion. So, logging inside a function what that function does, is much easier and more consitant than making the caller responsible.

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
Even if you added no log lines to your endpoint logic, and you make one or more DB calls, you will see both a LAMD object, and details of the SQL call(s.) Placing log lines in strategic places, and passing the `ctx` object to your callers, gives you the best chance of knowing what is going on in your code. Leaving these lines in for production, gives us the best chance of solving production issues. Observability is key.

# Enabling LAMD and Health checks
If nothing goes wrong, this step is pretty easy (assuming you have set up DB access with [DATABASE_EXAMPLE.md](DATABASE_EXAMPLE.md).) In `src/app.js` add 'lamd' to your services, 'Health' to your routes, and 'lamd' to your psql_mods ...

    // Lists of modules to include on start-up
    const services = ['db', 'auth', 'lamd', ]
    const routes = ['FruitRoute', 'JunkRoute', 'Auth', 'Health', ]
    const psql_mods = ['junk', 'auth', 'token', 'lamd', ]

Then add the DB schema to your `db/scripts/V1__base.js` file...

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

Reset the DB to add the two LAMD tables (as a reminder from the DB examples) ...

    export SUPERUSER=`whoami`
    export DBHOST=localhost
    export DBNAME=local_yourapp_yourname
    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql

... and restart the server (to pick up the new route, service, and psql_mod.)

    node src/app.js | bunyan -o short

## Looking at endpoint requests
You should see a new module in the API docs [http://localhost:9500/api/v1](http://localhost:9500/api/v1). Let's look at the new 'Health' endpoints. `/Ping` should work out-of-the-box, it requires no auth and no DB etc. To access the LAMD objects that tell us what has been happening with our API server endpoints, let's first create a request with a DB call. Check inventory on Junk (without a token): [http://localhost:9500/api/v1/Junk](http://localhost:9500/api/v1/Junk). You likley get the auth error ...

    {"code":"invalid_token","message":"Missing or invalid authorization header"}

... which is good, because we also want to see what LAMD gives in this case. For a valid authenticated example you will need a valid token and role to get a positive result (I'm escaping chars for a shell) ...

    curl http://localhost:9500/api/v1/Auth\?client_id=whatever\&username=dude\@deviq.io\&password=password\&grant_type=password -X POST

See the [OAUTH_EXAMPLE.md](OAUTH_EXAMPLE.md) for more on this. Add to your /Junk URL the `?auth_token=TOKEN_VALUE` to create the authenticated log entry.

### Last100
Next, attempt to list the last 100 endpoint requests: [http://localhost:9500/api/v1/Logs?type=last100](http://localhost:9500/api/v1/Logs?type=last100).

You get another authorization error, because this endpoint is protected. It will also require that your user has either 'Dev' or 'DevOps' role. Let's upgrade our ident user with a 'Dev' role, and then reset the DB and then use our cURL login request endpoint to acquire a token.

Upgrade 'dude' to be a 'Dev' person also in `db/sample_data_1.psql` ...

      ('dude@deviq.io', 'ACqX5b7oFXZHOozGZo809A==.wXrhYtmmqLFL8Hvr6LIo0XF+Xq1RMAhEoKF54Pw+5RA=', 'reader,Dev')

Reset the DB ...

    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql

Next curl to get an access-token (I'm escaping chars for a shell)...

    curl http://localhost:9500/api/v1/Auth\?client_id=whatever\&username=dude\@deviq.io\&password=password\&grant_type=password -X POST

Grab that access_token value, and go back to your browser for last100, and add &auth_token=YOUR-TOKEN - this uses the wrapper feature of an alternate way to provide a token without using the 'Authorization' header.

Unfortunatly, you only see the `/Auth` POST request you made, because the DB was reset. Reload the tabs for `/Junk` with and without a token, to get more examples, and come back to this `/Logs?type=last100` tab and reload for the results. - Wait! the auth errors on that endpoint are not showing, what's up? As mentioned in the OAuth docs, our goal is to avoid consuming resources when users are not authorized. This error type is not recorded, to avoid consuming DB resources.

The results you see have limited attributes in the LAMD objects showing. This is partly due to attempting to protect data by not showing everything here. On any of these objects, you can take the req_uuid and get all the details of that object and all the debug lines that go with it. Copy the req_uuid value from the /Junk endpoint and open a tab using:

    http://localhost:9500/api/v1/Debug/THE-REQ-UUID?auth_token=YOUR-TOKEN

You should get something like this. Notice the `token` value and auth_id since this is an authenticated endpoint. Notice also the nested `debug: []` array (near the bottom) is filled with each `ctx.log.debug(f,obj)` call, showing the log level, the `f` value, and the object.

    {
    "success": true,
    "debug": [{
        "id": 3,
        "log": {
            "lamd": {
                "date": "2021-08-26T21:21:42.702Z",
                "role": [
                    "reader"
                ],
                "verb": "get",
                "route": "/Junk",
                "start": 1630012902702,
                "token": {
                    "exp": 1630013068,
                    "iid": 100,
                    "irole": "reader"
                },
                "params": {
                    "Version": "v1",
                    "auth_token": "TOKEN-VALUE.SIG"
                },
                "auth_id": 100,
                "conn_id": 109,
                "headers": {
                    "host": "localhost:9500",
                    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,ima,...",
                    "cookie": "G_AUTHUSER_H=0",
                    "connection": "keep-alive",
                    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleW...",
                    "cache-control": "max-age=0",
                    "accept-encoding": "gzip, deflate, br",
                    "accept-language": "en-US,en;q=0.9",
                    "upgrade-insecure-requests": "1"
                },
                "duration": 2,
                "req_uuid": "821ae10f-a40c-411e-96b0-b63d21be07c7",
                "statusCode": 200,
                "request_count": 1,
                "request_count_high": 1
            },
            "debug": [
                {
                    "f": "DB:PSqlJunk:get_collection:",
                    "method": "debug"
                },
                {
                    "f": "PostgreSqlCore:sqlQuery:-109-:PSQL:0",
                    "data": "SELECT id,item\nFROM junk\nWHERE di= 0",
                    "method": "debug"
                },
                {
                    "f": "PostgreSqlCore:sqlQuery:-109-:",
                    "data": {
                        "rows": [
                            {
                                "id": 1,
                                "item": "kitchen sink"
                            },
                            {
                                "id": 2,
                                "item": "kitchen sink"
                            }
                        ],
                        "command": "SELECT",
                        "time_ms": 1,
                        "rowCount": 5
                    },
                    "method": "debug"
                }
            ],
            "req_uuid": "821ae10f-a40c-411e-96b0-b63d21be07c7"
        }
    }],
    "req_uuid": "0f5bb7b6-b581-43af-9d79-5f5160c21459"
    }


# Auotmated health check monitoring
To support the need for an outside SaaS to monitor the health of our API server instances and alerts when endpoints return unexpected errors to our clients, we have the endpoint [http://localhost:9500/api/v1/Logs/pingComprehensive](http://localhost:9500/api/v1/Logs/pingComprehensive). When you go to this endpoint, you get ...

    {
    "success": true,
    "final_disposition": "s",
    "req_uuid": "496b5142-c1fa-413c-a4ff-5b12116b6883"
    }

This response with a `final_disposition: "s"` is an obscure reference to a security failure. We don't want to give clues on how to hack this endpoint.

### Security
You will need to add to this URL a `?secret=` to allow access to this endpoint. This is a security check method that is directly built into the endpoint logic. It allows us to use SaaS products without paying extra money for OAuth or other header based authentication. You will notice earlier we added a `health:` key to our `src/container.js` and there is a reference to process.env.HEALTH_SECURITY_KEYS. If we leave it empty, then the above secret= with no value should work.

To protect this endpoint, add to your environment a comma separated list of keys as a string (i.e. `HEALTH_SECURITY_KEYS=secret-1,s2,s3`) (or even just one string key without a comma) to require one of these values on this url.  Try this [http://localhost:9500/api/v1/Logs/pingComprehensive?secret=](http://localhost:9500/api/v1/Logs/pingComprehensive?secret=)

    {
    "subject": "Ping Comprehensive (Errors, perf, deadlocks, services) Aggregations of API",
    "final_disposition": "r",
    "date": "2021-08-26 13:09:22",
    "now": "2021-08-26 13:09:22",
    "time_ms": 18,
    "results": [
        {
            "success": true,
            "note": "no-note",
            "subject": "Errors (unexpected) Aggregations of API",
            "date": "2021-08-26T19:09:22.594Z",
            "num_results": 0,
            "results": [ ],
            "time_ms": 10,
            "do_email": false
        },
        {
            "success": true,
            "note": "duration > 500ms",
            "subject": "Hourly Performance Aggregations of API",
            "date": "2021-08-26T19:09:22.597Z",
            "num_results": 0,
            "results": [ ],
            "time_ms": 3,
            "do_email": false
        },
        {
            "success": true,
            "note": "no-note",
            "subject": "API Deadlocks",
            "date": "2021-08-26T19:09:22.599Z",
            "num_results": 0,
            "results": [ ],
            "time_ms": 2,
            "do_email": false
        },
        {
            "success": true,
            "note": "no-note",
            "subject": "Service health: RunQueue",
            "date": "2021-08-26T19:09:22.600Z",
            "results": {
                "error": "Service is not loaded: RunQueue"
            },
            "time_ms": 0,
            "do_email": false
        }
    ],
    "req_uuid": "29a42891-0cd4-4cdf-933a-316a4ce18fb0"
    }

## Results explaination
This result is 'comprehensive' in that several endpoint requests are being to cover the several kinds of concerns that can be important and then consolocated into one result JSON. The 'outer' 'results' array are the 4 different calls made. The other 'outer' attributes are the consolodated results. the final_disposition value is 'r' meaning 'Red' alert level. Looking inside each sub-request, we see the last entry has an error so the overall result is 'r'.

In our case, we have not loaded up the Runqueue service, so it has this error. On systems that do not use Runqueue, this part of the 'pingComprehensive
 endpoint can be commented out (see the document [ROUTES.md](ROUTES.md) for how to customize existing Blueprint.Node route modules.)

The four "comprehensive" checks being made here are:

* Unexpected endpoint errors based on statusCode
* Performance concerns based on `duration`
* DB deadlocks that may have occurred
* Runqueue service health

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

Again, a lot of details will be missing, including req_uuid values on objects because this is an aggregate (or group by) query that counts exception types. The `subject` indicates the type of query. `final_disposition` is the overall monitoring result status. See the [routes/r_health.js](routes/r_health.js) source for details on input paramater values. 

## Custom service health checks
Anyone who implements a `service` can also add a method called `Healthcheck` which then is exposed at this endpoint: [http://localhost:9500/api/v1/ServiceHealth](http://localhost:9500/api/v1/ServiceHealth)

    {
    "success": true,
    "service_name": "blueprint",
    "params": {
        "Version": "v1",
        "service": "Runqueue",
        "auth_token": "TOKEN-VALUE.SIG"
    },
    "service": false,
    "services": [ ],
    "req_uuid": "5cc08eeb-f422-4add-8b62-958e0eb904e7"
    }

If you had such a service, the name would show up in the `services: []` list, and you can target it with `?service=` to check th health of that service. (More on this in [SERVICES.md](SERVICES.md))
