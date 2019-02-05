interface KitItems {
  [key: string]: object;
}

import * as types from "../types";

import Logger from "./logger";

class Kit {
  services: KitItems;
  routes: KitItems;
  config: types.Config;
  constructor(config: types.Config) {
    this.services = {
      logger: new Logger(config),
      restify_logger: new Logger(config)
    };
    this.routes = {};
    this.config = config;
  }

  // CRB: Adding services so that they can be used later
  addService(name: string, obj: object): void {
    this.services[name] = obj;
  }

  // , constructor: <T>(arg: T), args
  newService(name: string) {
    // const dependencies = constructor.deps;
    // // throw new Error f+ "Service-Module '#{name}' is missing @deps" unless d
    // const needs = dependencies.services || [];
    // if (dependencies.mysql || dependencies.mongo) {
    //   needs.push("db");
    // }
    // throw new Error f+ "Service-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
    // this.services[name] = new constructor(this, args || []);
    return this.services[name];
  }

  // , constructor, args
  newRouteService(name: string) {
    // const dependencies = constructor.deps;
    // throw new Error f+ "Route-Module '#{name}' is missing @deps" unless d
    // const needs = dependencies.services || [];
    // needs.push("wrapper");
    // throw new Error f+ "Route-Module '#{name}' requires service '#{n}'" for n in needs when n not of @services
    // this.routes[name] = new constructor(this, args || []);
  }

  // constructor
  getServiceDependenciesNeeded(): Array<string> {
    // const dependencies = constructor.deps;
    // if (!dependencies) {
    //   // CRB: from what it looks like, the only reason name was being passed is to make this error good
    //   // throw new Error(f + ("Module '" + name + "' is missing @deps - ") + JSON.stringify(constructor));
    // }
    const needed: Array<string> = [];
    // for (let name in dependencies.services) {
    //   if (!this.services.hasOwnProperty(name)) {
    //     needed.push(name);
    //   }
    // }
    // if (dependencies.mysql || dependencies.mongo) {
    //   needed.push("db");
    // }

    return needed;
  }
}

export default Kit;
