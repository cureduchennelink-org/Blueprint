"use strict";
//
//	Server Initialization
//
//  Config setings (createServer; resify: handlers,allow_headers; api: static_file_server,port;)
//  restify.createServer @config.createServer
//  for handler in @config.restify.handlers
//  res.setHeader 'access-control-allow-headers', @config.restify.allow_headers
//  server.get /.*/, restify.serveStatic @config.api.static_file_server
//  server.listen @config.api.port, cb
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const restify_1 = __importDefault(require("restify"));
const merge_1 = __importDefault(require("lodash/merge"));
class Server {
}
exports.default = Server;
(kit) => {
    this.config = kit.services.config;
    this.log = kit.services.logger.log;
    this.restify_logger = kit.services.restify_logger;
    this.server = false;
    this.log.info("Server Initialized");
};
create();
{
    const options = merge_1.default({}, {
        log: this.restify_logger ? this.restify_logger : this.log
    }, this.config.createServer);
    this.server = restify_1.default.createServer(options);
}
//# sourceMappingURL=server.js.map