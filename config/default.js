// Generated by CoffeeScript 1.9.2
(function() {
  var ref, vp_email, vp_use;

  vp_email = 'node_modules/blueprint/views/email';

  vp_use = 'node_modules/blueprint/views/use';

  module.exports = {
    api: {
      port: 9500,
      ident_id: 98,
      longPollTimeout: 60000 * 10,
      authReqForPoll: false,
      static_file_server: {
        directory: './html_root',
        "default": 'index.html'
      }
    },
    throttling: {
      max_connections: 1000
    },
    lamd: {
      connect_url: 'mongodb://localhost/lamd?w=0&journal=false'
    },
    route_modules: {
      Auth: {
        "class": 'AuthRoute',
        file: 'node_modules/blueprint/routes/r_auth'
      },
      Poll: {
        "class": 'LongPoll',
        file: 'node_modules/blueprint/routes/r_poll'
      },
      Registration: {
        "class": 'Registration',
        file: 'node_modules/blueprint/routes/r_registration'
      },
      User: {
        "class": 'User',
        file: 'node_modules/blueprint/routes/r_user'
      }
    },
    service_modules: {
      web_config: {
        "class": 'WebConfig',
        file: 'node_modules/blueprint/lib/web_config'
      },
      template: {
        "class": 'EpicTemplate',
        file: 'node_modules/blueprint/lib/EpicTemplate',
        instConfig: {
          view_path: vp_email
        }
      },
      template_use: {
        "class": 'EpicTemplate',
        file: 'node_modules/blueprint/lib/EpicTemplate',
        instConfig: {
          view_path: vp_use
        }
      },
      tokenMgr: {
        "class": 'TokenMgr',
        file: 'node_modules/blueprint/lib/token_manager'
      },
      event: {
        "class": 'Event',
        file: 'node_modules/blueprint/lib/event'
      },
      db: {
        "class": 'Db',
        file: 'node_modules/blueprint/lib/db'
      },
      util: {
        "class": 'Util',
        file: 'node_modules/blueprint/lib/util'
      },
      auth: {
        "class": 'Auth',
        file: 'node_modules/blueprint/lib/auth'
      },
      router: {
        "class": 'Router',
        file: 'node_modules/blueprint/lib/router'
      },
      wrapper: {
        "class": 'Wrapper',
        file: 'node_modules/blueprint/lib/wrapper'
      },
      prototype: {
        "class": 'Prototype',
        file: 'node_modules/blueprint/lib/prototype'
      },
      push: {
        "class": 'Push',
        file: 'node_modules/blueprint/lib/push'
      },
      pollMgr: {
        "class": 'PollManager',
        file: 'node_modules/blueprint/lib/poll_manager'
      },
      ses: {
        "class": 'SES',
        file: 'node_modules/blueprint/lib/ses'
      },
      tripMgr: {
        "class": 'TripManager',
        file: 'node_modules/blueprint/lib/trip_manager'
      },
      lamd: {
        "class": 'Lamd',
        file: 'node_modules/blueprint/lib/lamd'
      },
      AgentHeader: {
        "class": 'AgentHeader',
        file: 'node_modules/blueprint/lib/agent_header'
      }
    },
    restify: {
      handlers: ['CORS', 'queryParser', 'bodyParser', 'requestLogger', 'authorizationParser']
    },
    route_prefix: {
      assests: '/s',
      api: '/api/:Version',
      upload: '/upload'
    },
    log: {
      name: 'server',
      level: 'debug'
    },
    auth: {
      key: 'jQ9PhcT3Xz',
      pbkdf2: {
        iterations: 150000,
        salt_size: 16,
        key_length: 32
      },
      bearer: 'blueprint',
      refreshTokenExpiration: '2050-01-01 23:59:59',
      accessTokenExpiration: 10 * 60,
      basic: {
        api_keys: {}
      }
    },
    db: {
      mysql: {
        pool: {
          host: 'localhost',
          port: 8889,
          user: 'root',
          password: 'root',
          database: 'blueprint',
          multipleStatements: true,
          supportBigNumbers: true,
          bigNumberStrings: true,
          waitForConnections: false,
          connectionLimit: 10,
          level2_debug: false
        },
        modules: {
          auth: {
            "class": 'SqlAuth',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_auth'
          },
          user: {
            "class": 'SqlUser',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_user'
          },
          token: {
            "class": 'SqlToken',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_token'
          },
          trip: {
            "class": 'SqlTrip',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_trip'
          },
          pset: {
            "class": 'SqlPSet',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
          },
          pset_item: {
            "class": 'SqlPSetItem',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
          },
          pset_item_change: {
            "class": 'SqlPSetItemChange',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_pset'
          },
          agent_header: {
            "class": 'SqlAgentHeader',
            file: 'node_modules/blueprint/lib/db/_mysql/sql_agent_header'
          }
        }
      },
      mongo: {
        options: 'mongodb://localhost/mydb',
        models: {
          Workout: {
            file: 'node_modules/blueprint/lib/db/_mongo/models/workout'
          }
        }
      }
    },
    push_service: {
      poll_interval: 5000,
      poll_limit: 30,
      max_buffer_size: 1000
    },
    prototype: {
      clear_psets_on_restart: true,
      modules: [
        {
          name: 'Todo',
          enable: true,
          auth_req: false,
          delta: ['Item'],
          datasets: {
            Item: {
              title: 's128',
              completed: 'n'
            }
          },
          data: {
            Item: [
              {
                title: 'myTitle',
                completed: ''
              }, {
                title: 'myTitle2',
                completed: ''
              }
            ]
          }
        }
      ]
    },
    ses: {
      accessKeyId: 'ACCESS_KEY_ID',
      secretAccessKey: 'SECRET_KEY',
      region: 'us-west-2',
      options: {
        urlPrefix: 'http://localhost:9500/'
      },
      debug_email: 'Blueprint Debug ToAddress <jamie.hollowell@dv-mobile.com>',
      "default": {
        BccAddresses: [],
        CcAddresses: [],
        Source: 'Blueprint Default Source <jamie.hollowell@dv-mobile.com>',
        ReplyToAddresses: [],
        ReturnPath: 'jamie.hollowell@dv-mobile.com'
      },
      emails: {
        forgot_password: {
          model: 'User',
          tmpl: 'Top',
          page: 'forgot_password',
          Subject: 'Did you forget your password?',
          Text: 'You have forgotten your password huh? Well, That sucks.'
        },
        verify_email_change: {
          model: 'User',
          tmpl: 'Top',
          page: 'verify_email_change',
          Subject: 'Please Verify Your Email Address',
          Text: 'Please click on the following link'
        },
        email_change_confirmed: {
          model: 'User',
          tmpl: 'Top',
          page: 'confirm_email_change',
          Subject: 'Your email address has been successfully verified.',
          Text: 'Thank you for verifying your new email address.'
        },
        verify_signup: {
          model: 'Signup',
          tmpl: 'Top',
          page: 'verify_signup',
          Subject: 'Please Verify Signup.',
          Text: 'Thank yor for signing up with us! Please click the link below'
        },
        signup_complete: {
          model: 'Signup',
          tmpl: 'Top',
          page: 'signup_complete',
          Subject: 'Signup Complete!',
          Text: 'Thank yor for signing up with us! Your email address has been verified and your account has been activated!'
        }
      }
    },
    web: {
      config_document: "(function() {\n	var	opts= {\n		rest: {\n			  host: '" + (typeof api_host !== "undefined" && api_host !== null ? api_host : 'localhost') + "'\n			, port: '" + ((ref = process.env.npm_config_elb_port) != null ? ref : 80) + "'\n			, prefix: 'api'\n			, version: 'v1'\n		}\n		, poll: {\n			auth_req: false\n		}\n		, settings: {\n			inactivity_timer_secs: (10 * 60) // 10 minutes\n		}\n	};\n\n	E.Extra.options= opts\n})();"
    }
  };

}).call(this);
