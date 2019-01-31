"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const merge_1 = __importDefault(require("lodash/merge"));
const kit_1 = __importDefault(require("./lib/kit"));
const server_1 = __importDefault(require("./lib/server"));
const config_1 = __importDefault(require("./config"));
const logger_1 = __importDefault(require("./lib/logger"));
const error_1 = __importDefault(require("./lib/error"));
const start = (services_enabled, routes_enabled, mysql_enabled, mysql_mods_enabled, mongo_enabled, more_config, more_kit) => {
    const kit = new kit_1.default();
    const config = merge_1.default(config_1.default(), more_config);
    kit.add_service("config", config);
    kit.add_service("logger", logger_1.default);
    kit.add_service("error", error_1.default);
    merge_1.default(kit, more_kit);
    const server = new server_1.default(kit);
    server.create();
    kit.add_service("server", server);
};
exports.default = start;
//# sourceMappingURL=index.js.map