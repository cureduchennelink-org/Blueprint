/**
 * Default Config File
 */

module.exports = {
		db : {
            mysql: {
                enable: false,
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
                enable: false,
                options: 'mongodb://localhost/mydb'
            }
		},
		api: {
			port: 9500
		},
		log: {
		    name: 'blueprint',
		    level: 'debug'
		}
}