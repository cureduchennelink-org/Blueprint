#
#	MySql Database Object
#
#	Include Resource Specific DB functions for MySql Here

{SqlCore}= require './sql_core'
{SqlUser}= require './sql_user'
{SqlToken}= require './sql_token'
{SqlAuth}= require './sql_auth'

class MySql
	constructor: (config, tokenMgr, log) ->
		@core= new SqlCore config.options, log
		@auth= new SqlAuth @core, log
		@user= new SqlUser @core, log
		@token= new SqlToken @core, tokenMgr, log

exports.MySql = MySql

