interface Kit {}

class Server {
  constructor(kit) {
    this.config = kit.services.config;
    this.log = kit.services.logger.log;
    this.restify_logger = kit.services.restify_logger;
    this.server = false;
    this.log.info("Server Initialized");
  }
}

export default Server;
