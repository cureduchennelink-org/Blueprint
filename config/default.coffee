#
#	Default Config File
#

module.exports=
	log:
		name: 'blueprint'
		level: 'debug'
	auth:
		key : 'jQ9PhcT3Xz'
		bearer: 'blueprint'
		refreshTokenExpiration: 30 * 24 * 60 * 60 # seconds (30 Days)
		accessTokenExpiration: 10 * 60 # seconds (10 Minutes)
	db:
		mysql:
			enable: false
			options:
				host: 'localhost'
				port: 8889
				user: 'root'
				password: 'root'
				database: 'blueprint'
				multipleStatements: true
				minConnections: 2
				maxConnections: 10
				idleTimeoutMillis: 60000
		mongo:
            enable: false
            options: 'mongodb://localhost/mydb'
	api:
        port: 9500
    route_modules: [
        { enable: true, name: 'auth',		class: 'AuthRoute', file: './routes/r_auth' }
        { enable: true, name: 'user',		class: 'User', 		file: './routes/r_user' }
        { enable: true, name: 'workout', 	class: 'Workout', 	file: './routes/r_workout' }
        { enable: true, name: 'prototype',	class: 'Prototype', file: './routes/r_prototype' }
    ]
	prototype_modules: [
		{
		name: 'Todo', enable: true, auth_req: false
		datasets:
			Category:
				name: 's128'
			Item:
				description: 's128', done:'n', category_id:'key'
		}
		{
		name: 'Baseball', enable: true, auth_req: false
		datasets:
			Team:
				name: 's128'
			Player:
				name: 's128', pos:'n', team_id:'key'
		}
	]
	route_prefix:
		assests: '/s'
		api: '/api/:Version'
		upload: '/upload'
