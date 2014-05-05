#
#	MySql Database Object
#
#	Include Resource Specific DB functions for MySql Here

{SqlCore}= require './sql_core'
{SqlUser}= require './sql_user'
{SqlToken}= require './sql_token'
{SqlAuth}= require './sql_auth'
{SqlPSet}= require './sql_pset'
{SqlTrip}= require './sql_trip'

# TODO: Pass in the whole kit. Pass in Auth to token module
class MySql
	constructor: (config, tokenMgr, log) ->
		@core= new SqlCore config.options, log
		@auth= new SqlAuth @core, log
		@user= new SqlUser @core, log
		@pset= new SqlPSet @core, log
		@trip= new SqlTrip @core, log
		@token= new SqlToken @core, tokenMgr, log

exports.MySql = MySql

