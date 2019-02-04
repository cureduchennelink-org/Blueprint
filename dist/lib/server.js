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
    constructor(kit) {
        this.config = kit.services.config;
        this.log = kit.services.logger.log;
        this.restify_logger = kit.services.restify_logger;
        this.server = false;
        this.log.info("Server Initialized");
    }
    create() {
        const options = merge_1.default({}, {
            log: this.restify_logger ? this.restify_logger : this.log
        }, this.config.createServer);
        this.server = restify_1.default.createServer(options);
    }
    start(cb) {
        return this.server.listen(this.config.api.port, cb);
    }
    addRestifyHandlers() {
        for (let handler in this.config.restify.handlers) {
            // @log.info "(restify handler) Server.use #{handler}", @config.restify[ handler]
            this.server.use(restify_1.default.plugins[handler], this.config.restify[handler]);
        }
    }
    addStaticServer() {
        // Static File Server (Must be last Route Created)
        const apiPath = '/api/*';
        const m = 'Api request did not match your route + method (extra slash?)';
        this.server.get(apiPath, (q, r, n) => {
            // r.send(new E.BadRequestError(m) // Don't let static-server match api calls
        });
        const path = '/*';
        // @log.debug "(restify) serveStatic", {path,"@config.api.static_file_server":@config.api.static_file_server}
        this.server.get(path, restify_1.default.plugins.serveStatic(this.config.api.static_file_server));
        // # serveStatic = require 'serve-static-restify'
    }
}
exports.default = Server;
//# sourceMappingURL=server.js.map