#
#	MySql Database Object
#
#	Include Resource Specific DB functions for MySql Here

{SqlCore}= 		require './sql_core'
{SqlUser}= 		require './sql_user'
{SqlToken}=		require './sql_token'
{SqlAuth}= 		require './sql_auth'
{SqlPSet}= 		require './sql_pset'

# TODO: Combine Push in to one module?
{SqlTrip}= 		require './sql_trip'
{SqlPSetItem}= 	require './sql_pset_item'
{SqlPSetItemChange}= 	require './sql_pset_item_change'

# TODO: Pass in the whole kit. Pass in Auth to token module
class MySql
	constructor: (config, tokenMgr, log) ->
		@core= 		new SqlCore config.options, log
		@auth= 		new SqlAuth @core, log
		@user= 		new SqlUser @core, log
		@pset= 		new SqlPSet @core, log
		@token= 	new SqlToken @core, tokenMgr, log

		# Push
		@pset= 				new SqlPSet @core, log
		@pset_item= 		new SqlPSetItem @core, log
		@pset_item_change= 	new SqlPSetItemChange @core, log

exports.MySql = MySql

