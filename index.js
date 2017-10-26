// Generated by CoffeeScript 1.9.2
exports.start = function() {
  var Error, Kit, Logger, M, Q, _, config, fn, handler, i, kit, len, log, mod, nm, opts, path, q_result, ref, ref1, ref2, ref3, ref4, ref5, ref6, restify, route, routePath, server, service, servicePath;
  M = require('moment');
  Q = require('q');
  restify = require('restify');
  _ = require('lodash');
  path = require('path');
  M.defaultFormat = 'YYYY-MM-DD HH:mm:ss';
  Kit = require('./lib/kit').Kit;
  config = (require('./config'))();
  Logger = require('./lib/logger').Logger;
  Error = require('./lib/error');
  kit = new Kit;
  kit.add_service('config', config);
  kit.new_service('logger', Logger);
  kit.add_service('error', Error);
  log = kit.services.logger.log;
  server = restify.createServer({
    log: log
  });
  kit.add_service('server', server);
  ref = kit.services.config.service_modules;
  for (nm in ref) {
    mod = ref[nm];
    if (!(mod.enable === true)) {
      continue;
    }
    log.info("Initializing " + mod["class"] + " Service...");
    opts = mod.instConfig ? [mod.instConfig] : null;
    servicePath = path.join(config.processDir, mod.file);
    kit.new_service(mod.name, (require(servicePath))[mod["class"]], opts);
  }
  ref1 = config.restify.handlers;
  for (i = 0, len = ref1.length; i < len; i++) {
    handler = ref1[i];
    if (_.isString(handler)) {
      log.info("(restify handler) Server.use " + handler, config.restify[handler]);
      server.use(restify[handler](config.restify[handler]));
    } else {
      log.info("(restify handler) Server.use " + handler + " and options", handler);
      server.use(restify[handler.nm](handler.options));
    }
  }
  log.info("(restify) Server.opts", config.restify.allow_headers);
  server.opts(/.*/, (function(_this) {
    return function(req, res) {
      var ref2;
      res.setHeader('access-control-allow-headers', ((ref2 = config.restify.allow_headers) != null ? ref2 : []).join(', '));
      return res.send(204);
    };
  })(this));
  ref2 = kit.services;
  for (nm in ref2) {
    service = ref2[nm];
    if (typeof service.server_use === 'function') {
      server.use(service.server_use);
    }
  }
  server.use(function(req, res, next) {
    if ("JSON" in req.params) {
      _.merge(req.params, JSON.parse(req.params.JSON));
    }
    return next();
  });
  server.use(function(req, res, next) {
    var param;
    for (param in req.params) {
      if (req.params[param] !== null && _.isString(req.params[param])) {
        req.params[param] = req.params[param].replace(/[<>]/g, "");
      }
    }
    return next();
  });
  ref3 = kit.services.config.route_modules;
  for (nm in ref3) {
    mod = ref3[nm];
    if (!(mod.enable === true)) {
      continue;
    }
    log.info("Initializing " + mod["class"] + " Routes...");
    routePath = path.join(config.processDir, mod.file);
    kit.new_route_service(mod.name, (require(routePath))[mod["class"]]);
    kit.services.wrapper.add(mod.name);
  }
  q_result = Q.resolve();
  ref4 = kit.services;
  fn = function(service) {
    if (typeof service.server_init === 'function') {
      q_result = q_result.then(function() {
        return service.server_init(kit);
      });
    }
    if (typeof service.server_init_promise === 'function') {
      return (function(service) {
        return q_result = service.server_init_promise(kit, q_result);
      })(service);
    }
  };
  for (nm in ref4) {
    service = ref4[nm];
    fn(service);
  }
  ref5 = kit.routes;
  for (nm in ref5) {
    route = ref5[nm];
    if (typeof route.server_init === 'function') {
      (function(route) {
        return q_result = q_result.then(function() {
          return route.server_init(kit);
        });
      })(route);
    }
  }
  ref6 = kit.services;
  for (nm in ref6) {
    service = ref6[nm];
    if (typeof service.server_start === 'function') {
      (function(service) {
        return q_result = q_result.then(function() {
          return service.server_start(kit);
        });
      })(service);
    }
  }
  q_result = q_result.then(function() {
    var defer, err;
    server.get(/.*/, restify.serveStatic(config.api.static_file_server));
    defer = Q.defer();
    try {
      server.listen(config.api.port, function() {
        log.info('Server listening at', server.url);
        return defer.resolve(null);
      });
    } catch (_error) {
      err = _error;
      defer.reject(err);
    }
    return defer.promise;
  });
  q_result = q_result.then(function() {
    return log.debug('SERVER NORMAL START');
  });
  q_result = q_result.fail(function(err) {
    log.error(err);
    log.error('SERVER FAILED TO INITIALIZE. EXITING NOW!');
    return process.exit(1);
  });
  return q_result;
};
