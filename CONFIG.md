# Config files
Blueprint.Node is designed to support the [12factor](https://12factor.net/) app concept. One aspect is being able to build the project (maybe into a container) and then deploy that one build into any number of environments without changes (i.e. TEST and then STAGE and eventually PRODUCTION.) The advantage to this is that what goes to production is by design the same build that you tested and UAT-ed. To accomplish this, there are values that need to change as you move to various environments, that must be 'injected' into the build / container of your software. There is a secondary need to modify the behavior of your code without making logic changes - these are typically configuration type information that your code references from outside your module.

## General concepts
Security requires that we keep secrets out of the repository. Use ENV vars for these. The idea around organizing this large config structure is generally to keep a top-level key for each service. If you create a service called e.g. DocuSign, you might make a docusign: { ... } top-level key in the config structure. When you want to access your config, you typically do this ...

    class DocuSign {
        static deps() {
            return {services: ['config'], config: 'docusign{send_envelope_uuid,timeout}'};
        }
        constructor( kit){
            this.config= 	kit.services.config.docusign;

            this.send_uuid= this.config.send_envelope_uuid

Try not to use other service's values as a dependency on your service/route to avoid confusion and hard to track mis-configurations. It is best to ask a service for a value that that service owns.

## Common entires
There are a number of supplied services that use this config, that you can set values for (or modify default values for.) Also some of the start-up code uses some of these config values. If you look over the [config/default.js](config/default.js) file, you will see the common ones: api, throttling, plamd, runqueue, route_modules, service_modules, db.psql.modules, db.psql, restify, route_prefix, auth, push_service, prototype, ses.

## Multiple files needed
In our examples we created a file `src/container.js` to hold our "configuration" information that we keep separate from our code. It is desirable to separate the parts of our configuration that is injected vs. the configuration that we set and gets packaged into our build artifact. There are also configuration values that the Blueprint.Node server wishes to set as defaults for services and routes that it impalements for us. To separate these three concerns, the system is designed to allow us to merge all of these values into a single object that is then exposed via the 'config' service.

### node_modules/blueprint/config/default.js
This file contains Blueprint.Node's default config values. It is loaded first, and them merged with your own config file. No ENV references are made in this file other than, if used, the web.config_document that uses `npm_config_elb_port`.

### src/container.js
By default, your config file is found at src/container.js, but can be a different directory or file by setting the env vars `npm_config_config_dir` and `npm_config_env`. These are the only two ENV vars used by Blueprint.Node - any others must be created and referenced by you, preferably only in `src/container.js`. Use process.env.YOU_VAR inside your config file. For example, the default config for api.port is 9500. To change it to be set via the ENV var PORT you would use ...

    module.exports = {
        api: {
            port: process.env.PORT,
        }
    }

### src/base.js
Some projects have a base.js file - what is this used for? This is how you separate the ENV provided config, with your values that get put into the build, but are not specific to your code. Best practice is to use this for fixed timing values (like refresh_token expiration) DB settings, and all the service/route/psql module locations that are being used. This second config file concept is not a feature of Blueprint.Node, but can be implemented if you like. Here is how that is done (we make it a function, in case we need to inject values that don't merge easily, such as binary data loaded from files)...

    //
    // 'Base' config (not specific to the environment)
    //
    // Note: These values overwrite blueprint's config/default, and can be overwritten by the caller: 'container.js'
    //
    module.exports= (future, params)=> ({
            auth: {
                refreshTokenExpiration: 60 * 60 * 2,
                accessTokenExpiration: 60 * 10, // seconds (10 Minutes)
            },
            route_modules: { ...},
            server_modules: { ...},
            db: {
                psql: {
                    pool: {
                        max: 20,
                        multipleStatements: false,
                    }
                    modules: {
                        ...
                    }
                }
            }
    })

    // src/container.js
    _= require( 'lodash')
    const config= {
        api: {
            port: process.env.PORT || 9101
        }
    }
    const base= require( './base')
    module.exports= _.merge( base( future, params), config) // Our container config overrides the base config


## Additional tricks

### Unique ENV params
You may wish to prefix all your ENV params, so it is not possible to cross up your projects and mess up another project database for example. You can do this in your `src/container.js` ...

    c_prefix= 'MYPROJ_'

    copy_env = function(prefix) {
    var match, param, results;
    match = new RegExp("^" + prefix);
    results = [];
    for (param in process.env) {
        if (param.match(match)) {
        results.push(process.env[param.slice(prefix.length)] = process.env[param]);
        }
    }
    return results;
    };

    copy_env(c_prefix);

    // Now, if you set MYPROJ_PORT you can just use process.env.PORT below the 'copy_env' line.

### Customer specific strings
Every customer has a handful of string values that go into various places in the config structure. If you place these into variables at the top of the config file, it is easier to find and change. For example ...

    const c_name = 'DevIQ Connect';
    const c_long_nm= 'FishCompz.net';
    const c_legal_nm= 'FishCompz LTD.';
    const c_info_eml= 'support@fishcompz.net';

    // Now use c_* vars in various places, such as SES settings for return address and legal information at the bottom of emails

### Other misc items
These things may be helpful ...

    protocol = "http" + (host === 'localhost' ? '' : 's') + "://"         <----- Allow localhost to be non-https, use this var in config strings

    auth: {
        key: process.env.AUTH_KEY,                                  <----- Value used for signing OAuth tokens; make yours unique
    },


    slack: {
        url:( process.env.SLACK_URL || false),              <----- Indicate that a value was not supplied
        on:( process.env.SLACK_ON=== 'true'),                <----- Boolean values from a string ENV var
    },

    health: {
        security_keys: (process.env.HEALTH_SECURITY_KEYS || '').split(',')        <----- Convert string EVN to array
    },

    facebook: {
        api_key: process.env.FACEBOOK_API_KEY || 'MISSING-ENV-FB_API_KEY',             <----- Defaults that help you diagnose missing ENV vars
        api_secret: process.env.FACEBOOK_API_SECRET || 'MISSING-ENV-FB_API_SECRET'      <----- Secrets injected as ENV strings
    },
    firebase: {
        creds: process.env.FIREBASE_JSON || "{env_needed: 'FIREBASE_JSON'}",
        databaseName: process.env.FIREBASE_DB || 'FIREBASE_DB_env_not_set'
    },

    perf: {
        test_user_override: (process.env.TEST_USER_OVERRIDE || '').length > 6,        <----- Safety check on values used
        mock_cred: process.env.TEST_USER_OVERRIDE
    },

    plamd: {
        poll_ms: process.env.LAMD_POLL_MS || 100,                            <----- Sane/production defaults to avoid setting or missing production ENV vars
        conn_age_secs: process.env.LAMD_CONN_AGE_SECS || 300,
        to_debug: process.env.LAMD_TO_LOG=== 'true',
        loud: process.env.LAMD_LOUD=== 'true',
    },

    db: {
        psql: {
            pool: {
                host: process.env.PSQL_HOST || "localhost",               <----- Local env defaults to ease development requirements
                port: process.env.PSQL_PORT || 5432,
                user: process.env.PSQL_USER || "ENV-PSQL_USER",
                password: process.env.PSQL_PASS || "password",
                database: process.env.PSQL_DBNAME || name_short + "_dev_" + port,
                level2_debug: process.env.LEVEL2 === "true"
            }
        },
    },
