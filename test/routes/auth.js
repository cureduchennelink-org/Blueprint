/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai= 	require('chai');
const Util= 	require('../lib/Util');

chai.should();

describe('Routes', ()=>

	it('should be true', done=>
		(Util.db.SqlQuery('SELECT * FROM ident'))
		.then(db_rows=> done()).fail(function(err){
			console.log({err});
			return done(err);
		})
	)
);
