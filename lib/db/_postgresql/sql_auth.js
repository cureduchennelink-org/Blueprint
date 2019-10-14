/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	User Database Functions
//
const Promise= require('bluebird');

class SqlAuth {
	static initClass() {
		this.deps= {};
	}
	constructor(core, kit){
		this.GetById = this.GetById.bind(this);
		this.core = core;
		this.table= 'ident';
		this.cred_col= 'eml';
		this.pwd_col= 'pwd';
		this.schema= {
			auth: ['id', 'tenant', 'role', this.pwd_col],
			cred: ['*'],
			Create: [this.cred_col,this.pwd_col, 'role'],
			UpdateById: [this.cred_col,this.pwd_col],
			GetByKey: {
				id: ['id', this.cred_col, 'tenant', 'role']
			},
			reread: ['*']
		};
		this.core.method_factory(this, 'SqlAuth');
	}

	GetById(ctx, id){ return this.GetByKey(ctx, 'id', [id]); }
	GetAuthCreds(ctx, cred_name){
		const f= 'DB.SqlAuth.GetAuthCreds:';
		ctx.log.debug(f, cred_name);

		return Promise.resolve().bind(this)
		.then(function() {

			// Grab the Ident Credentials
			const sql= `\
SELECT ${this.schema.auth.join(',')}
FROM ${this.table}
WHERE ${this.cred_col}= ? and di= 0\
`;
			return this.core.sqlQuery(ctx, sql, [cred_name]);})
		.then(db_rows => db_rows);
	}

	GetByCredName(ctx, cred_name){
		const f= 'DB.SqlAuth.GetByCredName:';
		ctx.log.debug(f, cred_name);

		return Promise.resolve().bind(this)
		.then(function() {

			// Grab the Ident Credentials
			const sql= `\
SELECT ${this.schema.cred.join(',')}
FROM ${this.table}
WHERE ${this.cred_col}= ? and di= 0\
`;
			return this.core.sqlQuery(ctx, sql, [cred_name]);})
		.then(db_rows => db_rows);
	}
}
SqlAuth.initClass();

exports.SqlAuth= SqlAuth;
