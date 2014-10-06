http= 	require 'http'
mysql= 	require 'mysql'
config= (require '../../config')()

throw new Error 'MYSQL NOT ENABLED' unless config.db.mysql.enable
config.db.mysql.pool.database+= '_test' # TODO: Move to config file?
exports.config= config


# Share a single connection between all test suites
# Create data in the database
# Cleanup data in the database (optional param?)

conn= false
S_GetConn= ()->
	if !conn
		conn= mysql.createConnection config.db.mysql.pool
	else
		conn


# Mock Restify Requests
class MockRestifyRequest
	constructor: (opts)->
		@headers= 		opts?.headers || {}
		@url= 			opts?.url || {}
		@method= 		opts?.method || {}
		@statusCode= 	opts?.statusCode || {}
		@params= 		opts?.params || {}
exports.MockRestifyRequest= MockRestifyRequest

# Mock Restify Responses
class MockRestifyResponse
	constructor: (opts)->
		@headers= opts?.headers || {}
	setHeader: (nm, val)-> @headers[nm]= val
	send: (data)-> @data= data
exports.MockRestifyResponse= MockRestifyResponse

exports.Setup= (data, cb) -> cb S_GetConn()

exports.TearDown= ()->
	conn.end()
	conn= false

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
exports.Create= (data)->