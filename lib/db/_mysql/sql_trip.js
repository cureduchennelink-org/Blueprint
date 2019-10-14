/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Trip Database Functions
//
const Promise= require('bluebird');

class SqlTrip {
	static initClass() {
		this.deps = {};
	}
	constructor(core, kit){
		this.db= core;
		this.table= 'trips';
		this.schema= {
			create: ['auth_ident_id','ident_id','token','domain','json','void','expires'],
			update_by_id: ['json','void','expires','returned','ident_id'],
			get_by_token: ['*'],
			get_by_id: ['*']
		};

		this.db.method_factory(this, 'SqlTrip');
	}

	get_by_token(ctx, token){
		const f= "DB:SqlTrip:get_by_token:";
		ctx.log.debug(f, token);

		return Promise.resolve().bind(this)
		.then(function() {

			const sql= `\
SELECT ${this.schema.get_by_token.join(',')} 
FROM ${this.table}
WHERE token= ? AND di= 0\
`;
			return this.db.sqlQuery(ctx, sql, [token]);})
		.then(db_rows => db_rows);
	}
}
SqlTrip.initClass();

exports.SqlTrip= SqlTrip;
