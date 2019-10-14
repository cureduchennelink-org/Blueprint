Promise= require 'bluebird'
mysql= require 'mysql'
_= require 'lodash'

db= false # Singleton
exports.Instance= (config)->
	return db if db isnt false
	console.log 'Connecting to DB...', {config}
	db= new Db config
	return db

# Databse Abrstration Object
class Db
	constructor: (@config)->
		@conn= mysql.createConnection @config.pool

	End: ()-> @conn.end; @conn= null
	SqlQuery: (sql, args)=>
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
	GetOne: (table, id)->
		Promise.resolve().bind @
		.then ->

			sql= 'SELECT * FROM '+ table+ ' WHERE id= ? AND di= 0'
			@SqlQuery sql, [id]
		.then (db_rows)->
			db_rows[0]

	# Inserts one record in to the database
	# Returns the full record that was inserted
	InsertOne: (table, new_values, reread)->
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
	DeleteByKey: (table, key, values)->
		Promise.resolve().bind @
		.then ->

			sql= 'DELETE FROM '+ table+
				  ' where '+ key+ ' IN (?)'
			args= [values]
			@SqlQuery sql, args
		.then (db_result)-> db_result

	GetByKey: (table, key, vals)=>
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

	PutByKey: (table, key, key_val, vals)=>
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
