"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Kit {
    constructor() {
        this.services = {};
        this.routes = {};
    }
    addService(name, obj) {
        this.services[name] = obj;
    }
    newService(name, constructor, args) {
        const dependencies = constructor.deps;
        // throw new Error f+ "Service-Module '#{name}' is missing @deps" unless d
        const needs = dependencies.services || [];
        if (dependencies.mysql || dependencies.mongo) {
            needs.push("db");
        }
        // throw new Error f+ "Service-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
        this.services[name] = new constructor(this, args || []);
        return this.services[name];
    }
    newRouteService(name, constructor, args) {
        const dependencies = constructor.deps;
        // throw new Error f+ "Route-Module '#{name}' is missing @deps" unless d
        const needs = dependencies.services || [];
        needs.push("wrapper");
        // throw new Error f+ "Route-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
        this.routes[name] = new constructor(this, args || []);
    }
    getServiceDependenciesNeeded(constructor) {
        const dependencies = constructor.deps;
        if (!dependencies) {
            // CRB: from what it looks like, the only reason name was being passed is to make this error good
            // throw new Error(f + ("Module '" + name + "' is missing @deps - ") + JSON.stringify(constructor));
        }
        const needed = [];
        for (let name in dependencies.services) {
            if (!this.services.hasOwnProperty(name)) {
                needed.push(name);
            }
        }
        if (dependencies.mysql || dependencies.mongo) {
            needed.push("db");
        }
        return needed;
    }
}
exports.default = Kit;
//# sourceMappingURL=kit.js.map