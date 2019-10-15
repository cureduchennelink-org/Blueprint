// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Default Config File
//
const vp_email= './views/email';
const vp_use= './views/use';
const rq_max= 1000* 1000;

module.exports= {
  agentHeader: {
    maxCount: 200,
  },
  api: {
    port: 9500,
    ident_id: 98,	// When the API needs to do something that requires an ident_id
    longPollTimeout: 60000* 10, // 10 Minutes
    authReqForPoll: false,
    static_file_server: {
      directory: './html_root',
      default: 'index.html',
    },
  },
  auth: {
    key: 'jQ9PhcT3Xz', // Used for crypto
    pbkdf2: {
      iterations: 150000,
      salt_size: 16,
      key_length: 32,
    },
    bearer: 'blueprint',
    refreshTokenExpiration: '2050-01-01 23:59:59',
    accessTokenExpiration: 10 * 60, // seconds (10 Minutes)
    basic: {
      apiKeys: {
        username: {
          password: 'password',
        },
      },
    },
  },
  throttling: { // Wrapper uses this for rejecting requests when we are this far behind
    max_connections: 1000,
  },
  lamd: {
    connect_url: 'mongodb://localhost/lamd?w=0&journal=false',
  },
  route_modules: {
    Auth: {class: 'AuthRoute', 	file: './routes/r_auth',
    },
    Poll: {class: 'LongPoll', 		file: './routes/r_poll',
    },
    Registration: {class: 'Registration', 	file: './routes/r_registration',
    },
    User: {class: 'User', 			file: './routes/r_user',
    },
    Workout: {class: 'Workout', 			file: './routes/r_workout',
    },
  },
  service_modules: {
    AgentHeader: {
      class: 'AgentHeader',
      file: './lib/agentHeader',
    },
    Auth: {
      class: 'Auth',
      file: './lib/auth',
    },
    web_config: {class: 'WebConfig',		file: './lib/web_config',
    },
    template: {class: 'EpicTemplate', 	file: './lib/EpicTemplate', instConfig: {view_path: vp_email},
    },
    template_use: {class: 'EpicTemplate', 	file: './lib/EpicTemplate', instConfig: {view_path: vp_use},
    },
    tokenMgr: {class: 'TokenMgr', 		file: './lib/token_manager',
    },
    event: {class: 'Event',			file: './lib/event',
    },
    db: {class: 'Db', 			file: './lib/db',
    },
    util: {class: 'Util', 			file: './lib/util',
    },
    router: {class: 'Router', 		file: './lib/router',
    },
    wrapper: {class: 'Wrapper', 		file: './lib/wrapper',
    },
    prototype: {class: 'Prototype', 	file: './lib/prototype',
    },
    push: {class: 'Push', 			file: './lib/push',
    },
    pollMgr: {class: 'PollManager', 	file: './lib/poll_manager',
    },
    ses: {class: 'SES', 			file: './lib/ses',
    },
    tripMgr: {class: 'TripManager', 	file: './lib/trip_manager',
    },
    lamd: {class: 'Lamd',			file: './lib/lamd',
    },

    RunQueue: {class: 'RunQueue',		file: './lib/runqueue',
    },
    elb_redirect: {class: 'ELBRedirect', file: './lib/elb_redirect',
    },
  }, // Force HTTPS if enabled

  runqueue: {
    // Notes: the *_at takes a 'moment().add' spec [number,string]; string should be one of:
    // (months or M) (weeks or w) (days or d) (hours or h) (minutes or m) (seconds or s)
    settings: {
      poll_interval_ms: false, jobs: 100, read_depth: 20,
    },
    topic_defaults: {
      back_off: 'standard', last_fail: false, // No special handling
      priority: 1000, group_ref: 'NONE', limit: rq_max, // no reasonable limit
      alarm_cnt: 8, warn_cnt: 3, warn_delay: [3, 'm'], alarm_delay: [10, 'm'], fail_at: [5, 'm'],
    },
    external_groups: {
      default: {connections: rq_max, requests: [rq_max, rq_max, 'm'],
      }, // No limit on connections or req's-per-min
      SES:	{},
      SampleTest: {},
    },
    topics: {},
    SAMPLE_topics: {
      alert_tropo: {
        service: 'IvyHealth.TropoAlert', type: 'per-user',
        priority: 300, run_at: [0, 's'], group_ref: 'Tropo',
      },
      alert_ses: {
        service: 'IvyHealth.SesAlert', type: 'per-user',
        priority: 320, run_at: [1, 's'], group_ref: 'SES',
      },
      poll_ivy_user: {
        service: 'IvyHealth.Readings', type: 'per-user,reoccur,fanout',
        priority: 350, run_at: [1, 'm'], group_ref: 'IvyHealth',
      },
    },
    DISABLED_topics: {
      email_daily_user: {
        service: 'Reports.Daily', type: 'per-user,reoccur',
        priority: 900, run_at: [1, 'day'], group_ref: 'SES',
      },
      email_weekly_user: {
        service: 'Reports.Weekly', type: 'per-user,reoccur',
        priority: 950, run_at: [7, 'day'], group_ref: 'SES',
      },
    },
  },
  restify: {
    handlers: ['queryParser', 'bodyParser', 'requestLogger', 'authorizationParser'],
    queryParser: {mapParams: true,
    },
    bodyParser: {mapParams: true,
    },
  },
  route_prefix: {
    assests: '/s',
    api: '/api/:Version',
    upload: '/upload',
  },
  log: {
    name: 'server',
    level: 'debug',
  },

  db: {
    mysql: {
      pool: {
        host: 'localhost',
        port: 3309,
        user: 'root',
        password: 'garfield2cat',
        database: 'blueprint',
        multipleStatements: true,
        supportBigNumbers: true,
        bigNumberStrings: true,
        waitForConnections: false,
        connectionLimit: 10,
        level2_debug: false,
      },
      modules: {
        agentHeader: {class: 'SqlAgentHeader', file: './lib/db/mysql/agentHeader'},
        auth: {class: 'SqlAuth', file: './lib/db/mysql/auth'},
        user: {class: 'SqlUser', 			file: './lib/db/_mysql/sql_user',
        },
        token: {class: 'SqlToken', 			file: './lib/db/_mysql/sql_token',
        },
        trip: {class: 'SqlTrip', 			file: './lib/db/_mysql/sql_trip',
        },
        pset: {class: 'SqlPSet', 			file: './lib/db/_mysql/sql_pset',
        },
        pset_item: {class: 'SqlPSetItem', 		file: './lib/db/_mysql/sql_pset',
        },
        pset_item_change: {class: 'SqlPSetItemChange', file: './lib/db/_mysql/sql_pset',
        },
        runqueue: {class: 'SqlRunQueue',		file: './lib/db/_mysql/sql_runqueue',
        },
      },
    },

    mongo: {
      options: 'mongodb://localhost/mydb',
      models: {
        Workout: {file: './lib/db/_mongo/models/workout'},
      },
    },
  },
  push_service: {
    poll_interval: 5000,
    poll_limit: 30, // How many changes to process at once
    max_buffer_size: 1000,
  },
  prototype: {
    clear_psets_on_restart: true,
    modules: [
      {
        name: 'Todo', enable: true, auth_req: false, delta: ['Item'],
        datasets: { // sub-resources of 'Todo'
          Item: {
            title: 's128', completed: 'n',
          },
        },
        data: {
          Item: [
            {title: 'myTitle', completed: ''},
            {title: 'myTitle2', completed: ''},
          ],
        },
      },

    ],
  },
  ses: {
    accessKeyId: 'ACCESS_KEY_ID',
    secretAccessKey: 'SECRET_KEY',
    region: 'us-west-2',
    options: {
      urlPrefix: 'http://localhost:9500/',
    },
    debug_email: 'Blueprint Debug ToAddress <jamie.hollowell@dv-mobile.com>', // Make False to send to actual email address
    default: {
      BccAddresses: [],
      CcAddresses: [],
      Source: 'Blueprint Default Source <jamie.hollowell@dv-mobile.com>',
      ReplyToAddresses: [],
      ReturnPath: 'jamie.hollowell@dv-mobile.com',
    }, // The email address to which bounce notifications are to be forwarded.
    emails: {
      forgot_password: {
        model: 'User', tmpl: 'Top', page: 'forgot_password',
        Subject: 'Did you forget your password?',
        Text: 'You have forgotten your password huh? Well, That sucks.',
      },
      verify_email_change: {
        model: 'User', tmpl: 'Top', page: 'verify_email_change',
        Subject: 'Please Verify Your Email Address',
        Text: 'Please click on the following link',
      },
      email_change_confirmed: {
        model: 'User', tmpl: 'Top', page: 'confirm_email_change',
        Subject: 'Your email address has been successfully verified.',
        Text: 'Thank you for verifying your new email address.',
      },
      verify_signup: {
        model: 'Signup', tmpl: 'Top', page: 'verify_signup',
        Subject: 'Please Verify Signup.',
        Text: 'Thank yor for signing up with us! Please click the link below',
      },
      signup_complete: {
        model: 'Signup', tmpl: 'Top', page: 'signup_complete',
        Subject: 'Signup Complete!',
        Text: 'Thank yor for signing up with us! Your email address has been verified and your account has been activated!',
      },
    },
  },
  web: {
    // Sample config document (see web_config service)
    config_document: `\
(function() {
	var	opts= {
		rest: {
			  host: '${typeof api_host !== 'undefined' && api_host !== null ? api_host : 'localhost'}'
			, port: '${ process.env.npm_config_elb_port != null ? process.env.npm_config_elb_port : 80}'
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
})();\
`,
  },
};
