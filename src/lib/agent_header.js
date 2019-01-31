// Generated by CoffeeScript 1.9.2
(function() {
  var AgentHeader, Promise, parse,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Promise = require('bluebird');

  parse = require('user-agent-parser');

  AgentHeader = (function() {
    AgentHeader.deps = {
      services: ['logger', 'config'],
      mysql: ['agent_header'],
      config: 'agent_header[count_max]'
    };

    function AgentHeader(kit) {
      this.server_start = bind(this.server_start, this);
      var config, ref;
      this.log = kit.services.logger.log;
      config = kit.services.config.agent_header;
      this.sdb = kit.services.db.mysql;
      this.ctx = {
        log: this.log,
        conn: false
      };
      this.count_max = (ref = config != null ? config.count_max : void 0) != null ? ref : 200;
      this.memcache = {};
      this.memcache_count = 0;
    }

    AgentHeader.prototype.server_start = function(kit) {
      var f;
      f = 'AgentHeader::server_start:';
      return Promise.resolve().bind(this).then(function() {
        return this.sdb.core.Acquire();
      }).then(function(c) {
        return this.ctx.conn = c;
      });
    };

    AgentHeader.prototype.xlate = function(agent_header_string) {
      var f, id;
      f = 'lib/AgentHeader.store';
      this.log.debug(f, {
        agent_header_string: agent_header_string
      });
      id = this.memcache[agent_header_string];
      if (id != null) {
        return id;
      }
      return Promise.resolve().bind(this).then(function() {
        var more, nm, rec, ref, sub_nm, val;
        more = {};
        ref = parse(agent_header_string);
        for (nm in ref) {
          rec = ref[nm];
          for (sub_nm in rec) {
            val = rec[sub_nm];
            more[nm + "_" + sub_nm] = val;
          }
        }
        return this.sdb.agent_header.InsertIfNew(this.ctx, agent_header_string, more);
      }).then(function(db_results) {
        id = db_results.insertId;
        return this._add(agent_header_string, id);
      }).then(function() {
        return id;
      });
    };

    AgentHeader.prototype._add = function(agent_header_string, id) {
      if (this.memcache_count > this.count_max) {
        this.memcache_count = 0;
        this.memcache = {};
      }
      return this.memcache[agent_header_string] = id;
    };

    return AgentHeader;

  })();

  exports.AgentHeader = AgentHeader;

}).call(this);
