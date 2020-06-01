# Environment settings

# JAC: HERE ARE MY LOCAL EXPORTS
#npm_config_api_host=localhost
#npm_config_server_port=9501
#npm_config_env=local
#npm_config_config_dir=config
#npm_config_custom_key=local_test
#npm_config_server_host=localhost
#npm_config_static_dir=./html_root

# export npm_config_server_port=9505 # USED FOR DB INSTANCE NAME
# export npm_config_mysql_key=dvmobile # TO ACCESS USER/PASS CHOICES

_ = require 'lodash'
moment= require 'moment'
moment.defaultFormat= 'YYYY-MM-DD HH:mm:ss'

cust= 'blueprint'
port = process.env.npm_config_server_port

custom =
	local_test:
		mysql:
			pool:
				user: 'root'
				password: 'password'

mysql_instances =
	dvmobile:
		password: 'DV-mobile2012'

config =
	rest:
		hostname: 'localhost'
		port: port
		version: 'v1'
	auth_runqueue:
		username: 'SYSTEM - TEST'
		password: 'password'
		ident_id: 97
	mysql:
		pool:
			host: 'localhost'
			port: 3306
			user: 'root'
			password: 'root'
			database: cust # + '_dev_' + port
			level2_debug: true

_.merge config, custom[process.env.npm_config_custom_key] if process.env.npm_config_custom_key
_.merge config.mysql.pool, mysql_instances[process.env.npm_config_mysql_key] if process.env.npm_config_mysql_key
module.exports = config
