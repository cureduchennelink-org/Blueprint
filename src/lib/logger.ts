import bunyan from "bunyan";

interface IReturn {
  (): void;
}

export default class Logger {
  config: object;
  constructor(kit) {
    this.config = kit.services.config;
    this.log = bunyan.createLogger(this.config.log);
    this.log.info("Logger Initialized...");
  }

  server_use(req, res, next): IReturn {
    if (
      this.config.hasOwnProperty("log_opts") &&
      this.config.log_opts.no_route_logs
    ) {
      return next();
    }

    req.log.info("ROUTE:", req.method, req.url);
    for (let item of req.params) {
      if (item !== "_") {
        req.log.info(`PARAM:${item}`);
      }
    }
    return next();
  }
}
