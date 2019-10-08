#
#	Default Config File
#

module.exports=
	api:
		port: 9300
		ident_id: 98	# When the API needs to do something that requires an ident_id
		longPollTimeout: 60000* 10 # 10 Minutes
		authReqForPoll: false
		static_file_server:
			directory: './html_root'
			default: 'index.html'
	route_modules:
		Auth:			enable: true,  	name: 'Auth',				class: 'AuthRoute', 	file: 'node_modules/blueprint/routes/r_auth'
		Poll:			enable:	true,  	name: 'Poll', 				class: 'LongPoll', 		file: 'node_modules/blueprint/routes/r_poll'
		Registration:	enable: true, 	name: 'Registration', 		class: 'Registration', 	file: 'node_modules/blueprint/routes/r_registration'
		User:			enable: true, 	name: 'User', 				class: 'User', 			file: 'node_modules/blueprint/routes/r_user'
	service_modules:
		template:		enable: true, name: 'template',		class: 'EpicTemplate', 	file: 'node_modules/blueprint/lib/EpicTemplate', instConfig: view_path: 'node_modules/blueprint/views/email'
		template_use:	enable: true, name: 'template_use',	class: 'EpicTemplate', 	file: 'node_modules/blueprint/lib/EpicTemplate', instConfig: view_path: 'node_modules/blueprint/views/use'
		tokenMgr:		enable: true, name: 'tokenMgr',		class: 'TokenMgr', 		file: 'node_modules/blueprint/lib/token_manager'
		db:				enable: true, name: 'db',			class: 'Db', 			file: 'node_modules/blueprint/lib/db'
		util:			enable: true, name: 'util',			class: 'Util', 			file: 'node_modules/blueprint/lib/util'
		auth:			enable: true, name: 'auth',			class: 'Auth', 			file: 'node_modules/blueprint/lib/auth'
		router:			enable: true, name: 'router',		class: 'Router', 		file: 'node_modules/blueprint/lib/router'
		wrapper:		enable: true, name: 'wrapper',		class: 'Wrapper', 		file: 'node_modules/blueprint/lib/wrapper'
		prototype:		enable: true, name: 'prototype',	class: 'Prototype', 	file: 'node_modules/blueprint/lib/prototype'
		push:			enable: true, name: 'push',			class: 'Push', 			file: 'node_modules/blueprint/lib/push'
		pollMgr:		enable: true, name: 'pollMgr',		class: 'PollManager', 	file: 'node_modules/blueprint/lib/poll_manager'
		ses:			enable: true, name: 'ses',			class: 'SES', 			file: 'node_modules/blueprint/lib/ses'
		tripMgr:		enable: true, name: 'tripMgr',		class: 'TripManager', 	file: 'node_modules/blueprint/lib/trip_manager'
	restify:
		handlers: [ 'CORS','queryParser','bodyParser','requestLogger','authorizationParser' ]
	route_prefix:
		assests: '/s'
		api: '/api/:Version'
		upload: '/upload'
	log:
		name: 'server'
		level: 'debug'
	auth:
		key : 'jQ9PhcT3Xz' # Used for crypto
		pbkdf2:
			iterations: 150000
			salt_size:	16
			key_length:	32
		bearer: 'blueprint'
		refreshTokenExpiration: '2050-01-01 23:59:59'
		accessTokenExpiration: 10 * 60 # seconds (10 Minutes)
		basic: api_keys: {}
	db:
		mysql:
			enable: true
			pool:
				host: 'localhost'
				port: 8889
				user: 'root'
				password: 'root'
				database: 'blueprint'
				multipleStatements: true
				supportBigNumbers: true
				bigNumberStrings: true
				waitForConnections: false
				connectionLimit: 10
				level2_debug: false
			modules:
				auth:				enable: true,	class: 'SqlAuth', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_auth'
				user:				enable: true,	class: 'SqlUser', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_user'
				token:				enable: true,	class: 'SqlToken', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_token'
				trip:				enable: true,	class: 'SqlTrip', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_trip'
				pset:				enable: true,	class: 'SqlPSet', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
				pset_item:			enable: true,	class: 'SqlPSetItem', 		file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
				pset_item_change:	enable: true,	class: 'SqlPSetItemChange', file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
		mongo:
            enable: false
            options: 'mongodb://localhost/mydb'
            models:
            	Workout: enable: true, file: 'node_modules/blueprint/lib/db/_mongo/models/workout'
	push_service:
		poll_interval: 5000
		poll_limit: 30 # How many changes to process at once
		max_buffer_size: 1000
	prototype:
		clear_psets_on_restart: true
		modules: [
			{
			name: 'Todo', enable: true, auth_req: false, delta: ['Item']
			datasets: # sub-resources of 'Todo'
				Item:
					title: 's128', completed:'n'
			data:
				Item: [
					{ title: 'myTitle', completed:'' }
					{ title: 'myTitle2', completed:'' }
				]
			}

		]
	ses:
		accessKeyId: 	'ACCESS_KEY_ID'
		secretAccessKey: 'SECRET_KEY'
		region: 'us-west-2'
		options:
			urlPrefix: 'http://localhost:9500/'
		debug_email: 'Blueprint Debug ToAddress <jamie.hollowell@dv-mobile.com>' # Make False to send to actual email address
		default:
			BccAddresses: []
			CcAddresses: []
			Source: 'Blueprint Default Source <jamie.hollowell@dv-mobile.com>'
			ReplyToAddresses: []
			ReturnPath: 'jamie.hollowell@dv-mobile.com' # The email address to which bounce notifications are to be forwarded.
		emails:
			forgot_password:
				model: 'User', tmpl: 'Top', page: 'forgot_password'
				Subject: 'Did you forget your password?'
				Text: 'You have forgotten your password huh? Well, That sucks.'
			verify_email_change:
				model: 'User', tmpl: 'Top', page: 'verify_email_change'
				Subject: 'Please Verify Your Email Address'
				Text: 'Please click on the following link'
			email_change_confirmed:
				model: 'User', tmpl: 'Top', page: 'confirm_email_change'
				Subject: 'Your email address has been successfully verified.'
				Text: 'Thank you for verifying your new email address.'
			verify_signup:
				model: 'Signup', tmpl: 'Top', page: 'verify_signup'
				Subject: 'Please Verify Signup.'
				Text: 'Thank yor for signing up with us! Please click the link below'
			signup_complete:
				model: 'Signup', tmpl: 'Top', page: 'signup_complete'
				Subject: 'Signup Complete!'
				Text: 'Thank yor for signing up with us! Your email address has been verified and your account has been activated!'
