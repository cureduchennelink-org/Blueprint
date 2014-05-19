#
#	Default Config File
#

module.exports=
	route_modules: [	# Instantiated in order
        { enable: false, name: 'auth',			class: 'AuthRoute', 	file: './routes/r_auth' }
        { enable: false, name: 'user',			class: 'User', 			file: './routes/r_user' }
        { enable: false, name: 'workout', 		class: 'Workout', 		file: './routes/r_workout' }
        { enable: false, name: 'register', 		class: 'Registration', 	file: './routes/r_registration' }
    ]
	service_modules: [	# Instantiated in order
        { enable: true, name: 'template',		class: 'EpicTemplate', 	file: './lib/EpicTemplate', instConfig: view_path: 'views/email'  }
        { enable: true, name: 'template_use',	class: 'EpicTemplate', 	file: './lib/EpicTemplate', instConfig: view_path: 'views/use'  }
        { enable: true, name: 'tokenMgr',		class: 'TokenMgr', 		file: './lib/token_manager'  }
        { enable: true, name: 'db',				class: 'Db', 			file: './lib/db'  }
        { enable: true, name: 'auth',			class: 'Auth', 			file: './lib/auth'  }
        { enable: true, name: 'router',			class: 'Router', 		file: './lib/router'  }
        { enable: true, name: 'wrapper',		class: 'Wrapper', 		file: './lib/wrapper'  }
        { enable: true, name: 'prototype',		class: 'Prototype', 	file: './lib/prototype'  }
        { enable: true, name: 'push',			class: 'Push', 			file: './lib/push'  }
        { enable: true, name: 'ses',			class: 'SES', 			file: './lib/ses'  }
        { enable: true, name: 'tripMgr',		class: 'TripManager', 	file: './lib/trip_manager'  }
    ]
	api:
		port: 9500
		ident_id: 98	# When the API needs to do something that requires an ident_id
		static_file_server:
			directory: './html_root'
			default: 'index.html'
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
			enable: false
			pool:
				host: 'localhost'
				user: 'root'
				password: 'root'
				database: 'blueprint'
				multipleStatements: true
				supportBigNumbers: true
				bigNumberStrings: true
				waitForConnections: false
				connectionLimit: 10
			modules: [
				{ enable: true, name: 'auth', 				class: 'SqlAuth', 			file: 'sql_auth'}
				{ enable: true, name: 'user', 				class: 'SqlUser', 			file: 'sql_user'}
				{ enable: true, name: 'token', 				class: 'SqlToken', 			file: 'sql_token'}
				{ enable: true, name: 'trip', 				class: 'SqlTrip', 			file: 'sql_trip'}
				{ enable: true, name: 'pset', 				class: 'SqlPSet', 			file: 'sql_pset'}
				{ enable: true, name: 'pset_item', 			class: 'SqlPSetItem', 		file: 'sql_pset_item'}
				{ enable: true, name: 'pset_item_change', 	class: 'SqlPSetItemChange', file: 'sql_pset_item_change'}
			]
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
			datasets:
				Item:
					title: 's128', completed:'n'
				Categories:
					label: 's128'
			}
			{
			name: 'League', enable: true, auth_req: false
			datasets:
				Team:
					name: 's128'
				Player:
					name: 's128', pos:'n', team_id:'key'
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