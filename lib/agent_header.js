// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Agent header parse/store service (Keep unique ID for long ugly strings)
//	TODO: DETERMINE IF WE NEED TO MAKE ONE LARGER PROMISE HERE, TO SERIALIZE OUR COMMON DB CONNECTION
//

const Promise = require('bluebird');
const parse = require('user-agent-parser');

class AgentHeader {
  static initClass() {
    this.deps = {
      services: ['logger', 'config'],
      mysql: ['agent_header'],
      config: 'agent_header[count_max]',
    };
  }
  constructor(kit) {
    this.server_start = this.server_start.bind(this);
    this.log = kit.services.logger.log;
    const config = kit.services.config.agent_header;
    this.sdb = kit.services.db.mysql;
    this.ctx = {log: this.log, conn: false};
    this.count_max =
      (config != null ? config.count_max : undefined) != null ?
        config != null ?
          config.count_max :
          undefined :
        200;
    this.memcache = {}; // For speed, hold onto strings we've encountered since startup (yields the id)
    this.memcache_count = 0; // Bump this, and when it hits the configured max, just forget everything and start again
  }

  server_start(kit) {
    // After the services are all created, we need to validate/load our dynamic references per topic
    const f = 'AgentHeader::server_start:';

    return Promise.resolve()
        .bind(this)
        .then(function() {
          return this.sdb.core.Acquire();
        })
        .then(function(c) {
          return (this.ctx.conn = c);
        });
  }

  // Converts (translates) a long ugly string to a short ID
  // TODO COULD ADD THE X-DV-VERSION STRING, SPLIT ON TILDE - OR COULD MAKE THIS ANOTHER METHOD TO XLATE TO AN ID MAYBE
  xlate(agent_header_string) {
    const f = 'lib/AgentHeader.store';
    this.log.debug(f, {agent_header_string});
    // Someone has a string on an inbound endpoint request; try to quickly process it
    // only if brand new should we parse it and store all the details
    let id = this.memcache[agent_header_string]; // 'id' in the closure, will be returned eventually
    if (id != null) {
      return id;
    } // Nice, it was cached
    // Could be in the DB, so check there next
    return Promise.resolve()
        .bind(this)
        .then(function() {
        // Store in db (if not already there) and get ID
          const more = {};
          const object = parse(agent_header_string);
          for (const nm in object) {
            const rec = object[nm];
            for (const sub_nm in rec) {
              const val = rec[sub_nm];
              more[`${nm}_${sub_nm}`] = val;
            }
          }
          return this.sdb.agent_header.InsertIfNew(
              this.ctx,
              agent_header_string,
              more
          );
        })
        .then(function(db_results) {
        // TODO IS THIS ALLOWED TO FAIL?
          id = db_results.insertId;
          return this._add(agent_header_string, id);
        })
        .then(() => id);
  }

  _add(agent_header_string, id) {
    if (this.memcache_count > this.count_max) {
      this.memcache_count = 0;
      this.memcache = {};
    }
    return (this.memcache[agent_header_string] = id);
  }
}
AgentHeader.initClass();

exports.AgentHeader = AgentHeader;
