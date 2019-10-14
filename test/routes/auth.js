// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai= 	require('chai');
const Util= 	require('../lib/Util');

chai.should();

describe('Routes', () => it('should be true', () => (Util.db.SqlQuery('SELECT * FROM ident'))
.then(db_rows => true)));
