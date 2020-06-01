// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	User Database Functions
//
//	A User is the join between the ident table and the profile table.
//

class SqlUser {
	static initClass() {
		this.deps = {};
	}
	constructor(core, kit){
		this.db= core;
		this.table= 'profile';
		this.ident_tbl= 'ident';
		this.schema= {
			get_by_ident_id: [ // ident i LEFT OUTER JOIN profile e
				'i.id','i.eml',
				'e.fnm','e.lnm','e.cr','e.mo',
				'e.website','e.avatar_path','e.avatar_thumb','e.prog_lang','e.skill_lvl'],
			update_by_ident_id: ['fnm','lnm','website','avatar_path','avatar_thumb','prog_lang','skill_lvl'],
			Create: ['ident_id','fnm','lnm']
		};

		this.db.method_factory(this, 'SqlUser');
	}

	get_by_ident_id(ctx, ident_id){
		const f= "SqlUser:get_by_ident_id:";

		const sql= `\
SELECT ${this.schema.get_by_ident_id.join(',')}
FROM ${this.ident_tbl} i LEFT OUTER JOIN ${this.table} e
	 ON i.id= e.ident_id 
WHERE i.id= ? AND i.di= 0 AND (e.di= 0 OR e.id IS NULL)\
`;
		return (this.db.sqlQuery(ctx, sql, [ident_id]))
		.then(db_rows => db_rows);
	}
}
SqlUser.initClass();
exports.SqlUser= SqlUser;
