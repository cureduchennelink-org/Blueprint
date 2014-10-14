Q= 		require 'q'
_= 		require 'lodash'
http= 	require 'http'
mysql= 	require 'mysql'
config= (require '../../config')()

throw new Error 'MYSQL NOT ENABLED' unless config.db.mysql.enable
config.db.mysql.pool.database+= '_test' # TODO: Move to config file?
config.log.name= 'test'
exports.config= config


# Share a single connection between all test suites
# Query the databse
# Create data in the database
# Cleanup data in the database (optional param?)


exports.encryptedPassword= 'xfGuZKjVkoNgQyXxYT8+Hg==.f+uw2I+dqzfOE4O82Znikrbdb0lOONBxl/xcWGsQtFI='

class Db
	constructor: (@config)->
		@conn= mysql.createConnection @config.pool

	End: ()-> @conn.end; @conn= null
	SqlQuery: (sql, args)=>
		throw new E.DbError 'DB:SQL:BAD_CONN' if @conn is null
		(Q.ninvoke @conn, 'query', sql, args)
		.then (rows_n_cols) ->
			rows_n_cols[0]

	# Grabs an entire record by id
	GetOne: (table, id)->
		Q.resolve()
		.then ()=>

			sql= 'SELECT * FROM '+ table+ ' WHERE id= ? AND di= 0'
			@SqlQuery sql, [id]
		.then (db_rows)->
			db_rows[0]

	# Inserts one record in to the database
	# Returns the full record that was inserted
	InsertOne: (table, new_values)->
		Q.resolve()
		.then ()=>

			cols= ['cr']; qs= ['?']; arg= [null]
			(cols.push nm; qs.push '?'; arg.push val) for nm, val of new_values
			sql= 'INSERT INTO '+ table+ ' ('+ (cols.join ',')+
				 ') VALUES ('+ (qs.join ',')+ ')'
			@SqlQuery sql, arg
		.then (db_result)=>

			@GetOne table, db_result.insertId
		.then (rec)-> rec

exports.db= new Db config.db.mysql


# data=
#   Items: [
#     { name: 'apple'  }
#     { name: 'tomato' }
#   ],
#   Categories: [
#     { name: 'fruit' }
#     { name: 'vegetable' }
#   ],
#   Categories_Items: [
#     { itemId: 'Items:0', categoryId: 'Categories:0' }
#     { itemId: 'Items:1', categoryId: 'Categories:0' }
#     { itemId: 'Items:1', categoryId: 'Categories:1' }
#   ]
#

# data= {
#   Users: [
#     { username: 'bob' }
#     { username: 'Users:0:username' }
#   ]
#

# dataSpec=
#   Users: {
#     username: 'bob',
#     specId: 'mySpecialUser'
#   },
#   Items: {
#     // this resolves to bob's id
#     // at creation time
#     userId: 'Users:mySpecialUser',
#     name: 'shovel'
#   }
#