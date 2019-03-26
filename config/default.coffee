#
#	Default Config File
#
vp_email= 'node_modules/blueprint/views/email'
vp_use= 'node_modules/blueprint/views/use'
rq_max= 1000* 1000

module.exports=
	api:
		port: 9500
		ident_id: 98	# When the API needs to do something that requires an ident_id
		longPollTimeout: 60000* 10 # 10 Minutes
		authReqForPoll: false
		static_file_server:
			directory: './html_root'
			default: 'index.html'
	throttling: # Wrapper uses this for rejecting requests when we are this far behind
		max_connections: 1000
	lamd:
		connect_url: 'mongodb://localhost/lamd?w=0&journal=false'
	route_modules:
		Auth:			class: 'AuthRoute', 	file: 'node_modules/blueprint/routes/r_auth'
		Poll:			class: 'LongPoll', 		file: 'node_modules/blueprint/routes/r_poll'
		Registration:	class: 'Registration', 	file: 'node_modules/blueprint/routes/r_registration'
		User:			class: 'User', 			file: 'node_modules/blueprint/routes/r_user'
	service_modules:
		web_config:		class: 'WebConfig',		file: 'node_modules/blueprint/lib/web_config'
		template:		class: 'EpicTemplate', 	file: 'node_modules/blueprint/lib/EpicTemplate', instConfig: view_path: vp_email
		template_use:	class: 'EpicTemplate', 	file: 'node_modules/blueprint/lib/EpicTemplate', instConfig: view_path: vp_use
		tokenMgr:		class: 'TokenMgr', 		file: 'node_modules/blueprint/lib/token_manager'
		event:			class: 'Event',			file: 'node_modules/blueprint/lib/event'
		db:				class: 'Db', 			file: 'node_modules/blueprint/lib/db'
		util:			class: 'Util', 			file: 'node_modules/blueprint/lib/util'
		auth:			class: 'Auth', 			file: 'node_modules/blueprint/lib/auth'
		router:			class: 'Router', 		file: 'node_modules/blueprint/lib/router'
		wrapper:		class: 'Wrapper', 		file: 'node_modules/blueprint/lib/wrapper'
		prototype:		class: 'Prototype', 	file: 'node_modules/blueprint/lib/prototype'
		push:			class: 'Push', 			file: 'node_modules/blueprint/lib/push'
		pollMgr:		class: 'PollManager', 	file: 'node_modules/blueprint/lib/poll_manager'
		ses:			class: 'SES', 			file: 'node_modules/blueprint/lib/ses'
		tripMgr:		class: 'TripManager', 	file: 'node_modules/blueprint/lib/trip_manager'
		lamd:			class:  'Lamd',			file: 'node_modules/blueprint/lib/lamd'
		AgentHeader:	class: 'AgentHeader',	file: 'node_modules/blueprint/lib/agent_header'
		RunQueue:		class: 'RunQueue',		file: 'node_modules/blueprint/lib/runqueue'
		elb_redirect:   class: 'ELBRedirect',   file: 'node_modules/blueprint/lib/elb_redirect' # Force HTTPS if enabled
		server:   		class: 'Server',   		file: 'node_modules/blueprint/lib/server'

	runqueue:
		# Notes: the *_at takes a 'moment().add' spec [number,string]; string should be one of:
		# (months or M) (weeks or w) (days or d) (hours or h) (minutes or m) (seconds or s)
		settings:
			poll_interval_ms: false, jobs: 100, read_depth: 20
		topic_defaults:
			back_off: 'standard', last_fail: false # No special handling
			priority: 1000, group_ref: 'NONE', limit: rq_max # no reasonable limit
			alarm_cnt: 8, warn_cnt: 3, warn_delay: [3,'m'], alarm_delay: [10,'m'], fail_at: [5, 'm']
		external_groups:
			default:	connections: rq_max, requests: [rq_max, rq_max, 'm'] # No limit on connections or req's-per-min
			SES:		{}
			SampleTest: {}
		topics: {}
		SAMPLE_topics:
			alert_tropo:
				service: 'IvyHealth.TropoAlert', type: 'per-user'
				priority: 300, run_at: [0,'s'], group_ref: 'Tropo'
			alert_ses:
				service: 'IvyHealth.SesAlert', type: 'per-user'
				priority: 320, run_at: [1,'s'], group_ref: 'SES'
			poll_ivy_user:
				service: 'IvyHealth.Readings', type: 'per-user,reoccur,fanout'
				priority: 350, run_at: [1,'m'], group_ref: 'IvyHealth'
		DISABLED_topics:
			email_daily_user:
				service: 'Reports.Daily', type: 'per-user,reoccur'
				priority: 900, run_at: [1,'day'], group_ref: 'SES'
			email_weekly_user:
				service: 'Reports.Weekly', type: 'per-user,reoccur'
				priority: 950, run_at: [7,'day'], group_ref: 'SES'
	restify:
		handlers: [ 'queryParser','bodyParser','requestLogger','authorizationParser' ]
		queryParser: mapParams: true
		bodyParser: mapParams: true
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
				auth:				class: 'SqlAuth', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_auth'
				user:				class: 'SqlUser', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_user'
				token:				class: 'SqlToken', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_token'
				trip:				class: 'SqlTrip', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_trip'
				pset:				class: 'SqlPSet', 			file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
				pset_item:			class: 'SqlPSetItem', 		file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
				pset_item_change:	class: 'SqlPSetItemChange', file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
				agent_header:		class: 'SqlAgentHeader',	file: 'node_modules/blueprint/lib/db/_mysql/sql_agent_header'
				runqueue:			class: 'SqlRunQueue',		file: 'node_modules/blueprint/lib/db/_mysql/sql_runqueue'

		mongo:
			options: 'mongodb://localhost/mydb'
			models:
				Workout: file: 'node_modules/blueprint/lib/db/_mongo/models/workout'
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
	web:
		# Sample config document (see web_config service)
		config_document: """
(function() {
	var	opts= {
		rest: {
			  host: '#{api_host ? 'localhost'}'
			, port: '#{ process.env.npm_config_elb_port ? 80}'
			, prefix: 'api'
			, version: 'v1'
		}
		, poll: {
			auth_req: false
		}
		, settings: {
			inactivity_timer_secs: (10 * 60) // 10 minutes
		}
	};

	E.Extra.options= opts
})();
			"""
