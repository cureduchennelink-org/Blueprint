/**
 * Config File for the EC2 Instance on Epic
 */

module.exports = {
		db : {
			host: 'localhost',
		    user: 'root',
		    password: 'DV-mobile2012',
		    database: 'blueprint',
		    multipleStatements: true,
		    minConnections: 2,
		    maxConnections: 10,
		    idleTimeoutMillis: 60000
			}
}