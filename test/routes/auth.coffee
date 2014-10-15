chai= 	require 'chai'
Util= 	require '../lib/Util'

chai.should()

describe 'Routes', ()->

	it 'should be true', (done)->
		(Util.db.SqlQuery 'SELECT * FROM ident')
		.then (db_rows)->
			done()

		.fail (err)->
			console.log {err}
			done err
