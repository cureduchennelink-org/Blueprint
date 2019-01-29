/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Refresh Token Database Functions
//

const Q= require('q');
const E= require('../../error');

class SqlToken {
	constructor(core, kit){
		this.UpdateActiveToken = this.UpdateActiveToken.bind(this);
		this.core = core;
		this.log= kit.services.logger.log;
		this.table= 'ident_tokens';
		this.schema= {
			Create: ['token','ident_id','client','exp'],
			get: ['*'],
			reread: ['*']
		};
		this.core.method_factory(this, 'SqlToken');
	}

	GetNonExpiredToken(ctx, token){
		const sql= `SELECT ${this.schema.get.join(',')} FROM ${this.table}`+
			 ' WHERE token = ? AND exp > CURDATE()';
		return (this.core.sqlQuery(ctx, sql, [token]))
		.then(db_rows=> db_rows);
	}

	UpdateActiveToken(ctx, new_values, current_ident_token){
		return Q.resolve().then(()=> {
			// Delete current refresh token if it exists
			if (!current_ident_token) { return false; }
			const sql= `DELETE FROM ${this.table} WHERE token = ?`;
			return this.core.sqlQuery(ctx, sql, [current_ident_token]);
	})
		.then(db_result=> {
			// Insert New Token
			let reread;
			return this.Create(ctx, new_values, (reread= true));
	}).then(db_rec=> db_rec);
	}
}

exports.SqlToken= SqlToken;