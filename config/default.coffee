#
#	Default Config File
#

module.exports=
	api:
		port: 9500
		ident_id: 98	# When the API needs to do something that requires an ident_id
		longPollTimeout: 60000* 10 # 10 Minutes
		authReqForPoll: false
		static_file_server:
			directory: './html_root'
			default: 'index.html'
	route_modules:
		Auth:			enable: true,  	name: 'Auth',				class: 'AuthRoute', 	file: './routes/r_auth'
		Poll:			enable:	true,  	name: 'Poll', 				class: 'LongPoll', 		file: './routes/r_poll'
		Registration:	enable: true, 	name: 'Registration', 		class: 'Registration', 	file: './routes/r_registration'
	service_modules:
		template:		enable: true, name: 'template',		class: 'EpicTemplate', 	file: './lib/EpicTemplate', instConfig: view_path: 'views/email'
		template_use:	enable: true, name: 'template_use',	class: 'EpicTemplate', 	file: './lib/EpicTemplate', instConfig: view_path: 'views/use'
		tokenMgr:		enable: true, name: 'tokenMgr',		class: 'TokenMgr', 		file: './lib/token_manager'
		db:				enable: true, name: 'db',			class: 'Db', 			file: './lib/db'
		util:			enable: true, name: 'util',			class: 'Util', 			file: './lib/util'
		auth:			enable: true, name: 'auth',			class: 'Auth', 			file: './lib/auth'
		router:			enable: true, name: 'router',		class: 'Router', 		file: './lib/router'
		wrapper:		enable: true, name: 'wrapper',		class: 'Wrapper', 		file: './lib/wrapper'
		prototype:		enable: true, name: 'prototype',	class: 'Prototype', 	file: './lib/prototype'
		push:			enable: true, name: 'push',			class: 'Push', 			file: './lib/push'
		ses:			enable: true, name: 'ses',			class: 'SES', 			file: './lib/ses'
		tripMgr:		enable: true, name: 'tripMgr',		class: 'TripManager', 	file: './lib/trip_manager'
	restify:
		handlers: [ 'queryParser','bodyParser','requestLogger' ]
	route_prefix:
		assests: '/s'
		api: '/api/:Version'
		upload: '/upload'
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
			modules:
				auth:				enable: true,	class: 'SqlAuth', 			file: 'sql_auth'
				user:				enable: true,	class: 'SqlUser', 			file: 'sql_user'
				token:				enable: true,	class: 'SqlToken', 			file: 'sql_token'
				trip:				enable: true,	class: 'SqlTrip', 			file: 'sql_trip'
				pset:				enable: true,	class: 'SqlPSet', 			file: 'sql_pset'
				pset_item:			enable: true,	class: 'SqlPSetItem', 		file: 'sql_pset'
				pset_item_change:	enable: true,	class: 'SqlPSetItemChange', file: 'sql_pset'
		mongo:
            enable: false
            options: 'mongodb://localhost/mydb'
            models: [
            	{ enable: true, name: 'Workout',		file: 'workout' }
            ]
	push_service:
		poll_interval: 5000
	prototype:
		modules: [
			{
			name: 'Todo', enable: true, auth_req: false, delta: ['Item']
			datasets: # sub-resources of 'Todo'
				Item:
					title: 's128', completed:'n'
				Category:
					label: 's128'
			data:
				Item: [
					{ title: 'myTitle', completed:'' }
					{ title: 'myTitle2', completed:'' }
				]
			}

		]
	ses:
		accessKeyId: 	'AKIAI5FIAQV7AJEQOH3Q'
		secretAccessKey: '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'
		region: 'us-west-2'
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