import bunyan from "bunyan";

interface IReturn {
  (): void;
}
//  https://github.com/trentm/node-bunyan#levels
//  "fatal" (60): The service/app is going to stop or become unusable now. An operator should definitely look into this soon.
//  "error" (50): Fatal for a particular request, but the service/app continues servicing other requests. An operator should look at this soon(ish).
//  "warn" (40): A note on something that should probably be looked at by an operator eventually.
//  "info" (30): Detail on regular operation.
//  "debug" (20): Anything else, i.e. too verbose to be included in "info" level.
//  "trace" (10): Logging from external libraries used by your app or very detailed application logging.

export default class Logger {
  log: bunyan;
  constructor(logConfig: bunyan.LoggerOptions) {
    this.log = bunyan.createLogger(logConfig);
    this.log.trace("Logger Initialized...");
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
