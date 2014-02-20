#
#	MySql Database Object
#
#	Include Resource Specific DB functions for MySql Here

{SqlCore}= require './sql_core'
{SqlUser}= require './sql_user'

class MySql
	constructor: (config, log) ->
		@core= new SqlCore config.options, log
		@user= new SqlUser @core, log

exports.MySql = MySql

