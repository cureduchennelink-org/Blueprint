/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Refresh Token Database Functions
//
const Promise= require('bluebird');

class SqlToken {
	static initClass() {
		this.deps = {};
	}
	constructor(core, kit){
		this.UpdateActiveToken = this.UpdateActiveToken.bind(this);
		this.core = core;
		this.table= 'ident_tokens';
		this.schema= {
			Create: ['token', 'ident_id', 'client', 'exp'],
			get: ['i.id', 'i.tenant', 'i.role'],
			reread: ['*']
		};
		this.core.method_factory(this, 'SqlToken');
	}

	GetNonExpiredToken(ctx, token){
		// By joining with ident table, we won't keep giving out cached creds for e.g. tenant/role
		const sql= `\
SELECT ${this.schema.get.join(',')} FROM ${this.table} t
JOIN ident i ON i.id= t.ident_id
WHERE token = ? AND exp > CURRENT_DATE\
`;
		return (this.core.sqlQuery(ctx, sql, [token]))
		.then(db_rows => db_rows);
	}

	UpdateActiveToken(ctx, new_values, current_ident_token){
		return Promise.resolve().bind(this)
		.then(function() {
			// Delete current refresh token if it exists
			if (!current_ident_token) { return false; }
			const sql= `\
DELETE FROM ${this.table} 
WHERE token = ?\
`;
			return this.core.sqlQuery(ctx, sql, [current_ident_token]);})
		.then(function(db_result){
			// Insert New Token
			let reread;
			return this.Create(ctx, new_values, (reread= true));}).then(db_rec => db_rec);
	}
}
SqlToken.initClass();

exports.SqlToken= SqlToken;
