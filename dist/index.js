"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kit_1 = __importDefault(require("./lib/kit"));
const server_1 = __importDefault(require("./lib/server"));
const start = (services_enabled, routes_enabled, mysql_enabled, mysql_mods_enabled, mongo_enabled, more_config, more_kit) => {
    const kit = new kit_1.default();
    const server = new server_1.default(kit);
    server.create();
    kit.add_service("server", server);
};
exports.default = start;
//# sourceMappingURL=index.js.map