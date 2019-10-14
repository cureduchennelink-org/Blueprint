chai= 	require 'chai'
Util= 	require '../lib/Util'

chai.should()

describe 'Routes', ()->

	it 'should be true', ->
		(Util.db.SqlQuery 'SELECT * FROM ident')
		.then (db_rows)->
			true
