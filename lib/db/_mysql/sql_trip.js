/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Trip Database Functions
//

const Q= require('q');
const E= require('../../error');


class SqlTrip {
	constructor(core, kit){
		this.log= kit.services.logger.log;
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
		this.log.debug(f, token);

		return Q.resolve()
		.then(() => {

			const sql= `SELECT ${this.schema.get_by_token.join(',')} FROM ${this.table}` +
				' WHERE token= ? AND di= 0';
			return this.db.sqlQuery(ctx, sql, [token]);
	})
		.then(db_rows=> db_rows);
	}
}

exports.SqlTrip= SqlTrip;