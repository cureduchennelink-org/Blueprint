# Simple example of using a database
Building off of the example from the [README.md](README.md) we can add route modules that are backed by DB persistance. Additionally, use of a DB means we can now expose built-in services and capabilities such as LAMD logging with its HealthCheck endpoints, and OAuth 2.0 based authentication.

## Prerequisites
Blueprint.Node has built-in support for Postgres using standard SQL commands against the 'pg' npm package. The API server connects to one database and uses the public schema. You will need access to a working Postgres instance (either locally, or using RDS for example.) We will use basic scripts to initialize the schema, and we'll use the config file src/container.js from the [README.md](README.md) example to configure access to the DB for Blueprint.Node.

### Super user set up
Eventually we'll create a reset script that can be run over and over, even while the API server is running. There are some one-time setups for the 'cluster' which are global to all databases on the 'cluster'. All these psql and create* commands should be run as the cluster/database "super user." On a local machine, this is likely your local login (run whoami to see your name.) Alternatively the database may be set up and run as the username 'postgres'. We'll use  ENV vars to allow us to run this example in any environment. You may also need to place your password in PGPASSWORD or ~/.pgpass. Set this ENV var for your situation...

    export SUPERUSER=`whoami`

 or maybe...

    export SUPERUSER=postgres


### A few ENV vars to cut down on custom changes
Change these values to match your ENV...

    export DBHOST=localhost
    export DBNAME=local_yourapp_yourname

### Establish yourself as a cmdline user
Postgres wants the superuser to have a database with the same name as the user. It is ok to run this  more than once and ignore the 'already created' error.

    createdb --user $SUPERUSER --host $DBHOST $SUPERUSER

### One time cluster set up for roles
This is one way to manage permissions. Roles are global and and users are also global but require a password, so we set them up once here. For now we want to use the literal user names 'local_api' and 'flyway' ...

    createuser --user $SUPERUSER --host $DBHOST --no-login readonly
    createuser --user $SUPERUSER --host $DBHOST --no-login readwrite
    createuser --user $SUPERUSER --host $DBHOST --no-login admin

Run these two separately; they will prompt for a password. You'll want to use the passwords later in the API server and your pipeline. (In our examples we use 'local_api_1234' and 'flyway_1234' as passwords) 

    createuser --user $SUPERUSER --host $DBHOST -e -P local_api
    createuser --user $SUPERUSER --host $DBHOST -e -P flyway

## Tell Blueprint.Node how to connect to your DB
Update the file `src/container.js` to include this additional hash value: `db:` (Note: make modifications to password to fit your environment):

	module.exports= {
        route_modules: { ... }
		db: {
			psql: {
				pool: {
					host: process.env.DBHOST,
					port: 5432, 	// PSQL uses this port number
					user: 'local_api',
					password: 'local_api_1234' // TODO rework example to make this process.env.PASSWORD,
					database: process.env.DBNAME,
				},
                modules: {
                    // Future psql_mods
                }
			}
		}
	}

## The PSQL module
By putting SQL into its own module, we 'encapsulate' the implementation against the database, making it easier to refactor the table's schema without affecting the route/services layers. Additionally, we can add some javascript logic if needed or combine several SQL commands and give these a logical name within the module. Let's create the file src/psql_junk.js, then we'll tell Blueprint.Node where to find it, and finally we explicitly include this module in our main application's start-up script.

    //
    //	Junk Database Functions
    //

    class PSqlJunk {
        static deps() {
            return {};
        }
        constructor(core, kit) {
            this.table = "junk";
            this.schema = {
                GetCollection: ["id", "item",],
                DeleteById: true,
            };
            core.method_factory(this, "PSqlJunk");
        }

        async RemoveById(ctx, id) {
            return this.DeleteById(ctx, id); // DeleteByID is a provided by method factory. See [lib/db/CommonCore.js](lib/db/CommonCore.js)
            // Alternatively: return this.DisposeByIds(ctx, [id])
        }
    }

    exports.PSqlJunk = PSqlJunk;

### Tell Blueprint.Node where to find this psql mod
Update the src/container.js `db.modules` section like this

            modules: {
                junk: { class: 'PSqlJunk', file: 'src/psql_junk' },
            }

### Add the psql mod to your main application script
Change this section of code in src/app.js (to include 'db' in the services list, and 'junk' in a new psql_mods list)...

	const services = ['db']
	const psql_mods = ['junk']


## Getting rid of 'Junk'
Previously we created an in-memory backed Fruit route module; this time we will create a DB backed Junk route module with 'get junk' and 'remove junk' endpoints. This module src/r_junk.js should look familiar but includes some interesting additional Blueprint.Node references. Some things to note regarding the source close shown below:
##### static deps()
This method declares our dependencies to Blueprint.Node (services, database modules, and configuration values.) We will be building a DB layer SQL module called 'junk' so we add that to this method.
##### this.db
We need a reference to the db service's core postgres module. This is how we do it. The result is a core service that will also be populated with psql_mods that we will be referencing in our route logic
##### this.endpoints.*.sql_conn
We use `sql_conn: true` on both endpoints because both require a DB connection to get/remove information. This is how we request the 'wrapper' to acquire a database handle from the pool, before calling our endpoint logic.
##### this.endpoints.*.sql_tx
We use `sql_tx: true` to start a transaction, only on the 'remove junk' endpoint, since it will mutate the database. The current logic is trivial and only has one DB call, so it might not make sense in this case for a transaction. However, when we or someone else goes back into this logic, and adds a `getById()` to check first for existence, then we'll need a read consistent transaction context, so doing this by rote, until we have a specific use case to avoid it, is best practice. This will automatically commit or rollback if there is an error when the route is called.
##### this.db.MODULE.METHOD( ctx, ...)
Using the database layer modules from inside our endpoint logic is done this way (referencing the psql module via this.db and then a method, and passing `ctx` first). We will be creating a 'junk' psql module. All methods in the psql modules will take a `ctx` as their first parameter. This is how that downstream module/method gets reference to the DB handle form the pool, and will ensure all DB calls during this endpoint request are wrapped in the same transaction.
##### dbResults.affectedRows
Mutation queries that do not have a RETURNING clause, will have an '.affectedRows' value. This is not strictly how postgres pg module works; however, this is done by Blueprint.Node so that your route logic can switch easily to using MySQL responses.

    //
    // Junk route endpoints
    //
    class JunkRoute {
        static deps() {
            return { services: ['error'], psql: ['junk'] }
        }
        constructor(kit) {
            this.E = kit.services.error // Common error types
            this.db = kit.services.db.psql

            // Junk Endpoints
            this.endpoints = {
                getJunk: {
                    verb: 'get',
                    route: '/Junk',
                    use: true,
                    wrap: 'default_wrap',
                    version: { any: this.S_GetJunk.bind(this) },
                    sql_conn: true,
                },
                removeJunk: {
                    verb: 'del',
                    route: '/Junk/:id/remove',
                    use: true,
                    wrap: 'default_wrap',
                    version: { any: this.S_RemoveJunk.bind(this) },
                    sql_conn: true,
                    sql_tx: true,
                }
            }
        }

        // GET /Junk

        async S_GetJunk(ctx) {
            const useDoc = {
                params: {},
                response: { success: 'bool', junk: '{Array}' }
            }
            if (ctx === 'use') return useDoc
            const send = { success: true, junk: [] }

            // Grab all Junk from the "database" (empty results are ok)
            send.junk = await this.db.junk.GetCollection(ctx) // Notice your calling the service in the PSQL module above.

            // Respond to the client
            return { send }
        }

        // POST /Junk/:id/remove

        async S_RemoveJunk(ctx) {
            const f = 'JunkRoute:S_RemoveJunk:'
            const useDoc = {
                params: {},
                response: { success: 'bool' }
            }
            if (ctx === 'use') return useDoc
            const send = { success: true }
            let dbResults
            const { id: junkId } = ctx.p // Pull in the param

            // Dispose of the pre-loaded Junk (confirm we have/had Junk to eat)
            dbResults = await this.db.junk.RemoveById(ctx, junkId)

            // We could choose to skip this check if we wanted to be idempotent
            // Or use E.DbError to alert devs of an unexpected condition (or E.ServerError)
            if (dbResults.affectedRows !== 1) throw new this.E.NotFoundError(f, `${f}JunkTable:remove`)

            // Respond to the client
            return { send }
        }
    }

    exports.JunkRoute = JunkRoute

### Tell Blueprint.Node where to find this route module
Update the src/container.js route_modules section with this line

            route_modules: {
                ...
                JunkRoute: { class: 'JunkRoute', file: 'src/r_junk' },
            }

### Expose this module's routes
Update src/app.js by adding 'JunkRoute' to the array of 'routes' to be exposed.

## Initialize the database
As developers, we want to create a base schema, edit it over time, reset the DB's data, allow for test data to support easier testing including automated testing, and put all of this into an automated pipeline. These examples are consistent with use of FlyWay for your DB migrations (DB schema as code.)

### Populate some scripts
Start with a directory for database scripts including a place to keep sample data, and start with files for a first schema release, the sample data, permissions, and a manual DB init script. This latter script is typically used to initialize a DB to prepare it for FlyWay (permissions, etc.) and for local development and continuous integration environment creation.

#### File structure
Here is the sample file structure we can work from, where 'src' already exists (shown for context.) Establish these directories and files (empty for now) in your project:

	├── db
	│   ├── scripts
	│   │   └── V1__base.psql
	│   ├── permissions.psql
	│   ├── reset.psql
	│   └── sample_data_a.psql
	└── src

### Create db/reset.psql
This script can be used locally and in CI systems to bring up a DB from scratch w/sample_data. It also has some notes as a cheat sheet for those things we find hard to remember if we are used to working with MySQL. Place this code into db/reset.psql:

    --
    -- Reset DB for PostgreSQL
    --
    -- From the cmdline you can use:
    -- psql --no-password --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql
    --
    -- psql may want PGPASSWORD or ~/.pgpass (e.g. single line like: *:*:*:*:your_pwd)
    --
    -- For additional notes and prerequisites to using this script, see DATABASE_EXAMPLE.md in Blueprint.Node
    --
    -- Your DB super user (i.e. postgres) should also exist as a DB when using the cli:
    --  createdb --user $SUPERUSER $SUPERUSER
    -- psql: FATAL: database “<user>” does not exist
    -- https://stackoverflow.com/questions/17633422/psql-fatal-database-user-does-not-exist
    --
    --  Try to use all lower case for all names (db,table,columns), since the postgres converts to lowercase unless you use double quotes

    \set ON_ERROR_STOP on
    -- CREATE DATABASE IF NOT EXISTS :db;
    SELECT CONCAT( 'CREATE DATABASE ', :'db')
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db')\gexec

    \c :db;

    -- Drop the namespace instead of the DB, so existing DB connections stay intact
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    \i db/permissions.psql

    -- If you need the uuid field type, uncomment the next line
    -- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

    -- Include the Vx__*.psql and sample_data_x.psql files, preserving order for migration testing
    \i db/scripts/V1__base.psql;
    \i db/sample_data_a.psql;

### Create permissions.psql
To keep our API server from making schema changes and allowing a FlyWay user to make schema changes but not act outside of our public schema, we establish some base permissions for them here. Put these lines into db/permissions.psql...

    -- Revoke privileges from 'public' role
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    REVOKE ALL ON DATABASE :db FROM PUBLIC;

    -- Read-only role
    GRANT CONNECT ON DATABASE :db TO readonly;
    GRANT USAGE ON SCHEMA public TO readonly;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO readonly;

    -- Read/write role
    GRANT CONNECT ON DATABASE :db TO readwrite;
    GRANT USAGE ON SCHEMA public TO readwrite;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO readwrite;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO readwrite;

    -- Admin (read/write/schema-updates)  role
    GRANT CONNECT ON DATABASE :db TO admin;
    GRANT USAGE, CREATE ON SCHEMA public TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO admin;

    -- Users' permissions
    GRANT readwrite TO local_api;
    GRANT admin TO flyway;

## Populate the schema and sample data

### Make a place for our 'Junk'
 This is an example of how to establish a table. Do not use 'DROP TABLE' because these scripts are never re-run over the top of themselves, neither by FlyWay nor our reset script (db/reset.psql will drop the whole schema first.) Note: The 'mo' field won't reflect modified time automatically until we add a trigger for that later. Paste this code into db/scripts/V1__base.js...

    CREATE TABLE junk (
          id    SERIAL         PRIMARY KEY /* https://www.postgresqltutorial.com/postgresql-serial/ */
        , di    SMALLINT       DEFAULT 0 NOT NULL /* disposal - 0:none,1:disabled,2:purge*/
        , cr    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row created */
        , mo    TIMESTAMP(0)   DEFAULT CURRENT_TIMESTAMP /* row modified */

        ,item   VARCHAR(256)   NOT NULL
    );

### Make some 'Junk'
Put these lines into the db/sample_data_a.psql file, so we have some 'Junk' to remove later.

    INSERT INTO junk (item) VALUES
          ('kitchen sink')
        , ('kitchen sink')
        , ('wheat thins')
        , ('roof tile')
        , ('dog bed')
    ;


### Reset the DB
This script can be run over and over to reset the DB and start with fresh data and an updated schema...

    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql

### Fire up the app now

    $ node src/app.js | bunyan -o short

## Hit the API
There should be updated documentation here [http://localhost:9500/api/v1](http://localhost:9500/api/v1) and the old Fruit stuff [http://localhost:9500/api/v1/Fruit](http://localhost:9500/api/v1/Fruit) and now the new Junk stuff [http://localhost:9500/api/v1/Junk](http://localhost:9500/api/v1/Junk) ...

    {
        "success":true,
        "junk":[
            {"id":1,"item":"kitchen sink"},
            {"id":2,"item":"kitchen sink"},
            {"id":3,"item":"wheat thins"},
            {"id":4,"item":"roof tile"},
            {"id":5,"item":"dog bed"}
        ],
        "req_uuid":"33365ca7-0160-44bc-a5e0-3aa281f04a5c"
    }


#### Get rid of some of that junk...
 If you want to get rid of some junk (do we really need that roof tile laying around?) try...

    curl http://localhost:9500/api/v1/Junk/4/remove -X POST

You might try this remove on the same ID a second time - expect a 404:NotFound. Now reload the tab showing inventory.

### Nice.
For grins, let's reset the DB while the server is running, and check our inventory again...

    psql --user $SUPERUSER --host $DBHOST --echo-all --variable=db=$DBNAME < db/reset.psql

Now reload that junk inventory tab: [http://localhost:9500/api/v1/Junk](http://localhost:9500/api/v1/Junk) (that roof tile is back!)

## What's next?

Prev: [README.md](README.md)

Next: [OAUTH_EXAMPLE.md](OAUTH_EXAMPLE.md), then [LAMD_EXAMPLE.md](LAMD_EXAMPLE.md).
