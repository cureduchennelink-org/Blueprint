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
        port: 9500,
    },
    route_prefix: {
        assests: '/s',
        api: '/api/:Version',
        upload: '/upload'
    },
    log: {
        name: 'blueprint',
        level: 'debug'
    },
    auth : {
        key : 'jQ9PhcT3Xz',
        bearer: 'blueprint',
        refreshTokenExpiration : 30 * 24 * 60 * 60, // seconds (30 Days)
        accessTokenExpiration : 10 * 60 // seconds (10 Minutes)
    }
}