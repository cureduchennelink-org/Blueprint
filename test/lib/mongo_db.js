
Promise= require 'bluebird'
{MongoClient}= require 'mongodb'
_= require 'lodash'

db= false # Singleton
exports.Instance= (config)->
	return db if db isnt false
	console.log 'Connecting to DB... (as promise w/open)', {config}
	Promise.resolve().bind @
	.then ->
		db= new Db config
	.then ->
		db.open()
	.then ->
		db

# Databse Abrstration Object
class Db
	constructor: (@config)->
		@db= false
		@log= console

	open: ->
		f= 'TEST:Db.open:'
		@log.debug f+ 'TOP', {}
		Promise.resolve().bind @
		.then ->
			@log.debug f+ 'connect', {@config}
			MongoClient.connect @config
		.then (client)->
			mdb= client.db 'test' # JCS: NEW IN 3x IF YOU WERE USING 2x (RETURNS THE CLIENT NOT THE DB OF THE CLIENT)
			@log.debug f+ 'connect-result', {mdb, keys: Object.keys mdb}
			@log.debug f+ 'connect-result', {functions: (nm for nm,val of mdb when typeof val is 'function')}

			@log.debug f+ 'mdb', _.pick mdb, ['databaseName','options']
			throw new Error f+ 'MongoDB connection is empty' if not mdb? # Why does MongoDB need this check?
			@db= mdb
			@runqueue= mdb.collection 'runqueue' # Might not exist yet?
			@log.debug f+ 'collection-runqueue', @runqueue
			@log.debug f+ 'collection-runqueue-keys', {@runqueue, keys: Object.keys @runqueue}
			@log.debug f+ 'collection-runqueue-funcs', {functions: (nm for nm,val of @runqueue when typeof val is 'function')}

	delete: (collection, query_doc)->
		console.log "\n----COLLECTION----> ", collection, typeof @[collection]
		console.log "\n----QUERY_DOC----> ", query_doc
		@[collection].deleteMany query_doc
		.then (result)->
			console.log '----RESULT-> ', result.result
			result.result

	xEnd: ()-> @conn.end; @conn= null
	xSqlQuery: (sql, args)=>
		console.log "\n----SQL----> ", sql
		console.log '----ARGS---> ', (JSON.stringify args) if args
		throw new E.DbError 'DB:SQL:BAD_CONN' if @conn is null
		#console.log '----RUN--... '
		p_query= Promise.promisify @conn.query, context: @conn
		(p_query sql, args).bind @
		.then (just_rows) ->
			console.log '----RESULT-> ', if 'affectedRows' of just_rows then (JSON.stringify just_rows) else just_rows
			just_rows
#.catch (e) ->
#console.log '----FAIL---> ', e
#throw e

	# Grabs an entire record by id
	xGetOne: (table, id)->
		Promise.resolve().bind @
		.then ->

			sql= 'SELECT * FROM '+ table+ ' WHERE id= ? AND di= 0'
			@SqlQuery sql, [id]
		.then (db_rows)->
			db_rows[0]

	# Inserts one record in to the database
	# Returns the full record that was inserted
	xInsertOne: (table, new_values, reread)->
		Promise.resolve().bind @
		.then ->

			cols= ['cr']; qs= ['?']; arg= [null]
			(cols.push nm; qs.push '?'; arg.push val) for nm, val of new_values
			sql= 'INSERT INTO '+ table+ ' ('+ (cols.join ',')+
				 ') VALUES ('+ (qs.join ',')+ ')'
			@SqlQuery sql, arg
		.then (db_result)->

			return db_result if reread is false
			@GetOne table, db_result.insertId
		.then (rec)-> rec

	# Deletes records from the database where the column
	# 'key' matches values in the 'values' array
	xDeleteByKey: (table, key, values)->
		Promise.resolve().bind @
		.then ->

			sql= 'DELETE FROM '+ table+
				  ' where '+ key+ ' IN (?)'
			args= [values]
			@SqlQuery sql, args
		.then (db_result)-> db_result

	xGetByKey: (table, key, vals)=>
		throw new Error 'EMPTY_VALS' unless vals
		vals_type= typeof vals

		Promise.resolve().bind @
		.then ->

			args= if vals_type in ['number','string'] then [[vals]] else [vals]
			sql= 'SELECT * FROM '+ table+
				' WHERE di= 0 AND '+ key+ ' IN (?)'
			@SqlQuery sql, args
		.then (db_rows)->
			db_rows

	xPutByKey: (table, key, key_val, vals)=>
		throw new Error 'OBJECT_VALS' unless typeof vals is 'object'

		Promise.resolve().bind @
		.then ->

			vals_stuff= []
			args= []
			(vals_stuff.push " #{nm} = ?"; args.push vals[ nm]) for nm of vals
			args.push key_val
			sql= 'UPDATE '+ table+
				' SET '+ (vals_stuff.join ',')+
				' WHERE di= 0 AND '+ key+ ' = ?'
			@SqlQuery sql, args
		.then (db_rows)->
			db_rows
