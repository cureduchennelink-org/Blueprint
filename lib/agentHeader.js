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
// Agent header parse/store service (Keep unique ID for long ugly strings)
// TODO: DETERMINE IF WE NEED TO MAKE ONE LARGER PROMISE HERE,
// TO SERIALIZE OUR COMMON DB CONNECTION
//
const UAParser = require('ua-parser-js');

class AgentHeader {
  static initClass() {
    this.deps = {
      services: ['logger', 'config'],
      mysql: ['agentHeader'],
      config: 'agentHeader[count_max]',
    };
  }
  constructor(kit) {
    this.resource = 'AgentHeader';
    this.serverStart = this.serverStart.bind(this);
    this.log = kit.services.logger.log;
    this.config = kit.services.config.agentHeader;
    // TODO UPDATE TO USE AGNOSTIC DB
    this.db = kit.services.db.mysql;
    this.ctx = {
      log: this.log,
      conn: false,
    };

    this.UAParser = new UAParser();
    this.maxCount = this.config.countMax || 200;
    this._resetMemCacheCount();
  }

  async serverStart() {
    // TODO COULD THIS CONNECTION EXPIRE? SHOULD BE GETTING ANOTHER ONE?
    const connection = await this.db.core.acquire();
    this.ctx.conn = connection;
  }

  // Converts (translates) a long ugly string to a short ID
  // TODO COULD ADD THE X-DV-VERSION STRING, SPLIT ON TILDE
  // OR COULD MAKE THIS ANOTHER METHOD TO XLATE TO AN ID MAYBE
  // TODO NEED DOCUMENTATION
  async xLate(agentHeader) {
    const f = `${this.resource}:xLate::`;
    this.log.debug(f, {agentHeader});

    // Someone has a string on an inbound endpoint request;
    // try to quickly process it
    // only if brand new should we parse it and store all the details
    // 'id' in the closure, will be returned eventually
    let id = this.memcache[agentHeader];
    if (id) return id;
    const more = {};

    this.UAParser.setUA(agentHeader);
    const object = this.UAParser.getResult();
    console.log('object :', object);
    const map = new Map(Object.entries(object));

    map.forEach((val, key) => {
      if (typeof val === 'string') {
        return;
      }
      const subMap = new Map(Object.entries(val));
      subMap.forEach((subVal, subKey) => {
        more[`${key}_${subKey}`] = subVal;
      });
    });

    const dbResults = await this.db.agentHeader.insertIfNew(
        this.ctx,
        agentHeader,
        more
    );

    id = dbResults.insertId;
    return await this._add(agentHeader, id);
  }

  _resetMemCacheCount() {
    // For speed, hold onto strings we've encountered since startup
    // (yields the id)
    this.memcache = {};

    // Bump this, and when it hits the configured max, just forget
    // everything and start again
    this.memcache_count = 0;
  }

  _add(agentHeader, id) {
    if (this.memcache_count > this.maxCount) {
      this._resetMemCacheCount();
    }

    this.memcache_count++;
    return this.memcache[agentHeader] = id;
  }
}
AgentHeader.initClass();

exports.AgentHeader = AgentHeader;
