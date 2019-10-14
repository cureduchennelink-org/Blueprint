/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Agent-header DB methods
//
// browser_name: 'Chrome',
// browser_version: '44.0.2403.157',
// browser_major: '44',
// engine_name: 'WebKit',
// engine_version: '537.36',
// os_name: 'Linux',
// os_version: 'x86_64',
// device_model: undefined,
// device_vendor: undefined,
// device_type: undefined,
// cpu_architecture: 'amd64'
//
//
const Promise= require('bluebird');

class SqlAgentHeader {
	static initClass() {
		this.deps = {services: [ 'error' ]};
	}
	constructor(core, kit){
		this.db= core;
		this.E= kit.services.error;
		this.table= 'agent_header';
		this.schema= {
			InsertIfNew: [
				'browser_name', 'browser_version', 'browser_major',
				'engine_name', 'engine_version', 'os_name', 'os_version',
				'device_model', 'device_vendor', 'device_type', 'cpu_architecture'
				],
			GetByKey: { agent_header: [ 'id']
		}
		};

		this.db.method_factory(this, 'SqlAgentHeader');
	}

	InsertIfNew(ctx, agent_header, more_values){
		let nm, val;
		const f= "SqlAgentHeader.InsertIfNew:";
		ctx.log.debug(f, {agent_header, more_values});

		const extra_cols= this.schema.InsertIfNew;

		for (nm in more_values) {
			val = more_values[nm];
			if (!Array.from(extra_cols).includes(nm)) {
				throw new this.db.E.DbError(f+`:BAD_INSERT_COL-${this.table}-${nm}`);
			}
		}

		return Promise.resolve().bind(this)
		.then(function() {
			const cols=[ 'agent_header', 'agent_header_md5'];
			const qs=[ '?', 'MD5( ?)'];
			const args=[ agent_header, agent_header, ];
			for (nm in more_values) { val = more_values[nm]; cols.push(nm); qs.push('?'); args.push(val); }

			const sql= `\
INSERT INTO ${this.table} (cr, ${cols})
VALUES (null, ${qs})
ON DUPLICATE KEY UPDATE id= id, dummy= NOT dummy\
`;

			return this.db.sqlQuery(ctx, sql, args);}).then(db_result => db_result);
	}
}
SqlAgentHeader.initClass();

exports.SqlAgentHeader= SqlAgentHeader;
