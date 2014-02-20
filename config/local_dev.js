/**
 * Config File for MNC Server
 *
 */

module.exports = {
		db : {
            mysql: {
                enable: true,
                options: {
                    host: 'localhost',
                    port: 8889,
                    user: 'root',
                    password: 'root',
                    database: 'blueprint',
                    multipleStatements: true,
                    minConnections: 2,
                    maxConnections: 10,
                    idleTimeoutMillis: 60000
                }
            },
            mongo: {
                enable: true,
                options: 'mongodb://localhost/workout_tracker'
            }
		}
}
