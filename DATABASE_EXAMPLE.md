# Simple example of using a database
Building off of the example from the (README.md) we can add route modules that are backed by DB persistance. Additionally, use of a DB gives us the ability to utilize built-in services and capabilities such as LAMD logging with its HealthCheck endpoints, and OAuth 2.0 based authentication.

## Prerequisites
DVblueprint has built-in support for Postgres using standard SQL commands against the 'pg' npm package. You will need access to a working Postgres instance (either locally, or using RDS for example.) We will use basic scripts to initialize the schema, and we'll use the config file src/container.js from the (README.md) example to configure access to the DB for DVblueprint.

## Tell DVblueprint how to connect to your DB
Update the file src/container.js to include this additional hash value (Note: make modifications to fit your enviroment):

	module.exports= {
        route_modules: { ... }
		db: {
			psql: {
				pool: {
					host: 'localhost',
					port: 5432, 	// PSQL uses this port number
					user: 'postgres',
					password: 'yourpass',
					database: 'local_yourapp_yourname',
				},
                modules: {
                    // Future psql_mods
                }
			}
		}
	}

## Geting rid of 'Junk'
Previoulsy we created an in-memory backed Fruit route module; this time we will create a DB backed Junk route module with 'get junk' and 'remove junk' endpoints. This module src/r_junk.js should look familiar but includes some interesting additional DVblueprint references. Some things to note regarding the source close shown below:
##### static deps()
This method declares our dependencies to DVblueprint (services, database modules, and configuration values.) We will be building a DB layer SQL module called 'junk' so we add that to this method.
##### this.db
We need a reference to the db service's core postres module. This is how we do it. The result is a core service that will also be populated with psql_mods that we will be referencing in our route logic
##### this.endpoints.*.sql_conn
We use sql_conn: true on both endpoints because both require a DB connection to get/remove information. This is how we request the 'wrapper' to acquire a database handle from the pool, before calling our endpoint logic.
##### this.endpoints.*.sql_tx
We use sql_tx: true to start a transaction, only on the 'remove junk' endpoint, since it will mutate the database. The current logic is trivial and only has one DB call, so it might not make sense in this case for a transaction. However, when we or someone else goes back into this logic, and adds a getById() to check first for existence, then we'll need a read consistent transaction context, so doing this by rote, until we have a specific use case to avoid it, is best practice.
##### this.db.MODULE.METHOD( ctx, ...)
Using the database layer modules from inside our endpoint logic is done this way (referencing the psql module via this.db and then a method, and passing ctx first). We will be creating a 'junk' psql module. All methods in the psql modules will take a ctx as their first paramter. This is how that downstream module/method gets reference to the DB handle form the pool, and will ensure all DB calls during this endpoint request are wrapped in the same transaction.
##### dbResults.affectedRows
Mutation queries that do not have a RETURNING clause, will have an '.affectedRows' value. This is not strickly how postgres pg module works, however, this is done by DVblueprint so that your route logic can switch easily to using MySQL responses.

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
                    route: '/Junk/:id/eat',
                    use: true,
                    wrap: 'default_wrap',
                    version: { any: this.S_RemoveJunk.bind(this) },
                    sql_conn: true,
                    sql_tx: true,
                }
            }
        }

        // GET /Junk

        async S_GetJunk(ctx, preLoaded) {
            const useDoc = {
                params: {},
                response: { success: 'bool', Junk: '{Array}' }
            }
            if (ctx === 'use') return useDoc
            const send = { success: true, Junk: [] }

            // Grab all Junk from the "database" (empty results are ok)
            send.Junk = await this.db.junk.getAll()

            // Respond to the client
            return { send }
        }

        // POST /Junk/:id

        S_RemoveJunk(ctx) {
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
            dbResults = await this.db.junk.removeItem(ctx, junkId)
            // We could choose to skip this check if we wanted to be idempotent
            // Or use E.DbError to alert devs of an unexpected condition (or E.ServerError)
            if (dbResults.affectedRows !== 1) throw new this.E.NotFoundError(f, `${f}JunkTable:remove`)

            // Respond to the client
            return { send }
        }
    }

    exports.JunkRoute = JunkRoute

## The PSQL module
By putting SQL into its own module, we 'encasulate' the implementation against the database, making it easier to refactor the table's schema without affecting the route/services layers. Additionally, we can add some javascript logic if needed or combine several SQL commands and give these a logical name within the module. Let's create the file src/psql_junk.js, then we'll tell DVblueprint where to find it, and finally we explicitly include this module in our main application's start-up script.

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

        async Remove(ctx, id) {
            return this.DeleteById(ctx, id);
            // Alternatively: return this.DisposeByIds(ctx, [id])
        }
    }

    exports.PSqlJunk = PSqlJunk;

#### Notes
##### onething
this
##### another thing
other
