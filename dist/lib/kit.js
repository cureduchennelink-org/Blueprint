"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Kit {
    constructor() {
        this.services = {};
        this.routes = {};
    }
    add_service(name, obj) {
        this.services[name] = obj;
    }
}
exports.default = Kit;
//# sourceMappingURL=kit.js.map