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
class SqlAgentHeader {
  static initClass() {
    this.deps = {services: ['error']};
  }
  constructor(core, kit) {
    this.resource = 'SqlAgentHeader';
    this.db= core;
    this.E= kit.services.error;
    this.table= 'agent_header';
    this.schema= {
      insertIfNew: [
        'browser_name', 'browser_version', 'browser_major',
        'engine_name', 'engine_version', 'os_name', 'os_version',
        'device_model', 'device_vendor', 'device_type', 'cpu_architecture',
      ],
      GetByKey: {
        agent_header: ['id'],
      },
    };

    this.db.method_factory(this, 'SqlAgentHeader');
  }

  async insertIfNew(ctx, agentHeader, moreVals) {
    const f= `${this.resource}:insertIfNew::`;
    ctx.log.debug(f, {agentHeader, moreVals});
    const schema = this.schema.insertIfNew;
    const cols=['agent_header', 'agent_header_md5'];
    const qs=['?', 'MD5( ?)'];
    const args=[agentHeader, agentHeader];
    const map = new Map(Object.entries(moreVals));
    map.forEach((val, key) => {
      if (!schema.includes(key)) {
        throw new this.E.DbError(`${f}:BAD_INSERT_COL-${this.table}-${key}`);
      }
      if (!val) {
        return;
      }
      cols.push(key);
      qs.push('?');
      args.push(val);
    });

    const sql= `
      INSERT INTO ${this.table} (cr, ${cols})
      VALUES (null, ${qs})
      ON DUPLICATE KEY UPDATE id= id, dummy= NOT dummy
    `;

    return await this.db.sqlQuery(ctx, sql, args);
  }
}
SqlAgentHeader.initClass();

exports.SqlAgentHeader= SqlAgentHeader;
