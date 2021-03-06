// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
// Environment settings

// JAC: HERE ARE MY LOCAL EXPORTS
//npm_config_api_host=localhost
//npm_config_server_port=9501
//npm_config_env=local
//npm_config_config_dir=config
//npm_config_custom_key=local_test
//npm_config_server_host=localhost
//npm_config_static_dir=./html_root

// export npm_config_server_port=9505 # USED FOR DB INSTANCE NAME
// export npm_config_mysql_key=dvmobile # TO ACCESS USER/PASS CHOICES

const _ = require('lodash');
const moment= require('moment');
moment.defaultFormat= 'YYYY-MM-DD HH:mm:ss';

const cust= 'blueprint';
const port = process.env.npm_config_server_port;

const custom = {
	local_test: {
		mysql: {
			pool: {
				user: 'root',
				password: 'password'
			}
		}
	}
};

const mysql_instances = {
	dvmobile: {
		password: 'DV-mobile2012'
	}
};

const config = {
	rest: {
		hostname: 'localhost',
		port,
		version: 'v1'
	},
	auth_runqueue: {
		username: 'SYSTEM - TEST',
		password: 'password',
		ident_id: 97
	},
	mysql: {
		pool: {
			host: 'localhost',
			port: 3306,
			user: 'root',
			password: 'root',
			database: cust, // + '_dev_' + port
			level2_debug: true
		}
	}
};

if (process.env.npm_config_custom_key) { _.merge(config, custom[process.env.npm_config_custom_key]); }
if (process.env.npm_config_mysql_key) { _.merge(config.mysql.pool, mysql_instances[process.env.npm_config_mysql_key]); }
module.exports = config;
