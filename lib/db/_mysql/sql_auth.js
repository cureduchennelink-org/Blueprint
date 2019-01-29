/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	User Database Functions
//

const Q= require('q');
const E= require('../../error');

class SqlAuth {
	constructor(core, kit){
		this.GetById = this.GetById.bind(this);
		this.core = core;
		this.log= kit.services.logger.log;
		this.table= 'ident';
		this.cred_col= 'eml';
		this.pwd_col= 'pwd';
		this.schema= {
			auth: ['id', this.pwd_col],
			cred: ['*'],
			Create: [this.cred_col,this.pwd_col],
			UpdateById: [this.cred_col,this.pwd_col],
			GetByKey: {
				id: ['id', this.cred_col]
			},
			reread: ['*']
		};
		this.core.method_factory(this, 'SqlAuth');
	}

	GetById(ctx, id){ return this.GetByKey(ctx, 'id', [id]); }
	GetAuthCreds(ctx, cred_name){
		const f= 'DB.SqlAuth.GetAuthCreds:';
		this.log.debug(f, cred_name);

		return Q.resolve()
		.then(()=> {

			// Grab the Ident Credentials
			const sql= `SELECT ${this.schema.auth.join(',')}` +
				 ' FROM '+ this.table+ ' WHERE '+ this.cred_col+ '= ? and di= 0';
			return this.core.sqlQuery(ctx, sql, [cred_name]);
	})
		.then(db_rows=> {
			return db_rows;
		});
	}

	GetByCredName(ctx, cred_name){
		const f= 'DB.SqlAuth.GetByCredName:';
		this.log.debug(f, cred_name);

		return Q.resolve()
		.then(()=> {

			// Grab the Ident Credentials
			const sql= `SELECT ${this.schema.cred.join(',')}` +
				 ' FROM '+ this.table+ ' WHERE '+ this.cred_col+ '= ? and di= 0';
			return this.core.sqlQuery(ctx, sql, [cred_name]);
	})
		.then(db_rows=> {
			return db_rows;
		});
	}
}

exports.SqlAuth= SqlAuth;