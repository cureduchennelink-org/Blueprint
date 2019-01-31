//
//	Server Initialization
//
//  Config setings (createServer; resify: handlers,allow_headers; api: static_file_server,port;)
//  restify.createServer @config.createServer
//  for handler in @config.restify.handlers
//  res.setHeader 'access-control-allow-headers', @config.restify.allow_headers
//  server.get /.*/, restify.serveStatic @config.api.static_file_server
//  server.listen @config.api.port, cb

import restify from "restify";
import merge from "lodash/merge";

interface Kit {}

interface IFunc 
{
  (): void
}

export default class Server {
  restify_logger: IFunc 
  log: IFunc
  config: object
  server: 
  constructor(kit) {
    this.config = kit.services.config;
    this.log = kit.services.logger.log;
    this.restify_logger = kit.services.restify_logger;
    this.server = false;
    this.log.info("Server Initialized");
  }

  create() {
    const options = merge({}, 
      {
      log: this.restify_logger ? this.restify_logger : this.log
    },
    this.config.createServer)
    this.server = restify.createServer(options);
  }
}
