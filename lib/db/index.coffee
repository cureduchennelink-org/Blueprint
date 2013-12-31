#
#	Database Object
#
#	Include Resource Specific DB functions here

{DbCore}= require './db_core'
{User}= require './db_user'

class Db
	constructor: (config, log) ->
		@core= new DbCore config, log
		@user= new User @core, log
		
exports.Db = Db

