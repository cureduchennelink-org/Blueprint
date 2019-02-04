"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const merge_1 = __importDefault(require("lodash/merge"));
const min_1 = __importDefault(require("lodash/min"));
const bluebird_1 = __importDefault(require("bluebird"));
const kit_1 = __importDefault(require("./lib/kit"));
const server_1 = __importDefault(require("./lib/server"));
const config_1 = __importDefault(require("./config"));
const logger_1 = __importDefault(require("./lib/logger"));
const error_1 = __importDefault(require("./lib/error"));
const start = (servicesEnabled, routesEnabled, mysqlEnabled, mysqlModsEnabled, mongoEnabled, more_config, more_kit) => {
    let kit = new kit_1.default();
    const config = merge_1.default(config_1.default(), more_config);
    kit.addService("config", config);
    kit.addService("logger", logger_1.default);
    kit.addService("error", error_1.default);
    kit = merge_1.default(kit, more_kit);
    const server = new server_1.default(kit);
    server.create();
    kit.addService("server", server);
    [servicesEnabled, mysqlModsEnabled] = updateDependencies(kit, servicesEnabled, routesEnabled, mysqlModsEnabled);
    // Services
    for (let name in servicesEnabled) {
        const mod = kit.services.config.serviceModules[name];
        // throw new Error "No such service-module: #{nm}" unless mod
        mod.name = name;
        // log.info "Initializing #{mod.class} Service..."
        const options = mod.instConfig ? [mod.instConfig] : null;
        const servicePath = path.join(config.processDir, mod.file);
        kit.newService(mod.name, require(servicePath)[mod.class], options);
    }
    server.addRestifyHandlers();
    // Handle all OPTIONS requests to a deadend (Allows CORS to work them out)
    server.handleOptions();
    // Service Handlers
    if (server) {
        for (let name in kit.services) {
            if (typeof kit.services[name] === "function") {
                // log.info "Calling server.use for service: "+ nm
                server.server.use(kit.services[name].server_use);
            }
        }
    }
    server.parseJSON();
    server.stripHTML();
    // Routes
    for (let name in routesEnabled) {
        const mod = kit.services.config.routeModules[name];
        // throw new Error "No such route-module: #{nm}" unless mod
        mod.name = name;
        // log.info "Initializing #{mod.class} Routes..."
        const routePath = path.join(config.processDir, mod.file);
        kit.newRouteService(mod.name, require(routePath)[mod.class]);
        kit.services.wrapper.add(mod.name);
    }
    // Run Server Init Functions from Kit Service Modules
    let q_result = bluebird_1.default.resolve().bind(this);
    for (let name in kit.services) {
        const service = kit.services[name];
        // TODO: try to figure out what is going on here cause I have no idea
        // do(service)->
        // if typeof service.server_init is 'function'
        //   q_result= q_result.then -> service.server_init kit # Single return promise w/o embedded .then
        // if typeof service.server_init_promise is 'function'
        //   do(service)-> q_result= service.server_init_promise kit, q_result # will chain it's .then's
    }
    // # Run Server Init Functions from Kit Route Modules
    // for nm, route of kit.routes when typeof route.server_init is 'function'
    // 	do(route)-> q_result= q_result.then -> route.server_init(kit)
    // # Run Server Start Functions from Kit Service Modules
    // for nm, service of kit.services when typeof service.server_start is 'function'
    // 	do(service)-> q_result= q_result.then -> service.server_start(kit)
    // Start the Server
    if (server) {
        q_result = q_result.then(() => {
            // Static File Server (Must be last Route Created)
            if (config.api ? .static_file_server : ) {
                server.add_static_server();
            }
            return new bluebird_1.default((resolve, reject) => {
                try {
                    server.start(() => {
                        // log.info('Server listening at', server.server.url)
                        resolve(null);
                    });
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    }
    q_result = q_result.then(() => {
        // log.debug 'SERVER NORMAL START'
        return kit; // JCS: Return the kit so caller can get to servies (e.g. kit.services.server.server)
    });
    q_result = q_result.catch((err) => {
        // log.error err
        // log.error 'SERVER FAILED TO INITIALIZE. EXITING NOW!'
        process.exit(1);
    });
    return q_result;
};
const updateDependencies = (kit, servicesEnabled, routesEnabled, mysqlModsEnabled) => {
    const config = kit.services.config;
    const log = kit.services.log;
    const allMods = mysqlModsEnabled;
    const special = [];
    const serviceToDepedencies = {};
    for (let name in servicesEnabled) {
        serviceToDepedencies[name] = false;
    }
    if (routesEnabled.length) {
        for (let name in ["wrapper", "router"]) {
            serviceToDepedencies[name] = false;
        }
    }
    // Routes depend on services and mysql-mods; add their needs first
    for (let name in routesEnabled) {
        const mod = config.routeModules[name];
        if (!mod) {
            // TODO: Throw an error
            //throw new Error(`No such route module: ${name}`);
        }
        const servicePath = path.join(config.processDir, mod.file);
        const module = require(servicePath);
        // TODO: throw another error
        //throw new Error f+ "Class (#{mod.class}) not found in file (#{servicePath})" unless mod.class of module
        const dependencies = kit.getServiceDependenciesNeeded(module[mod.class]);
        for (let serviceName in dependencies) {
            // Add all services that any route depends on
            serviceToDepedencies[serviceName] = false;
        }
    }
    // service_to_deps[ nm]= [] for nm in special # These are base services with no deps that are always 'provided'
    let servicesToCheck = [];
    for (let service in serviceToDepedencies) {
        if (serviceToDepedencies[service] === false) {
            servicesToCheck.push(service);
        }
    }
    while (servicesToCheck.length) {
        // CRB: This is repeat code... DRY?
        // Good opportunity for recursion as we are doing the exact same thing above
        for (let name in servicesToCheck) {
            const mod = config.serviceModules[name];
            // throw new Error f+ "No such service-module: #{nm}" unless mod
            const servicePath = path.join(config.processDir, mod.file);
            const module = require(servicePath);
            //throw new Error f+ "Class (#{mod.class}) not found in file (#{servicePath})" unless mod.class of module
            const dependencies = kit.getServiceDependenciesNeeded(name, module[mod.class]);
            serviceToDepedencies[name] = dependencies;
            for (let dependency in dependencies) {
                if (serviceToDepedencies.hasOwnProperty(dependency)) {
                    serviceToDepedencies[dependency] = false;
                }
            }
            servicesToCheck = [];
            for (let service in serviceToDepedencies) {
                if (serviceToDepedencies[service] === false) {
                    servicesToCheck.push(service);
                }
            }
        }
    }
    const s2child = {};
    const allServices = [];
    const present = {};
    for (let service in serviceToDepedencies) {
        present[service] = false;
        s2child[service] = []; // Make sure I exist here, even if no deps
        // TODO: come back after you have went through a debugging of this, I am confused on how this is supposed to work
        // for nm,deps of service_to_deps
        // for dep in deps # Consider nm as a 'child' of each dependancy
        // 	s2child[ dep]?= []
        // 	s2child[ dep].push nm
        // 	present[ dep]= false
    }
    // Assume end-user got his services listed in the right order, for now # TODO
    // for service in services_enabled when not present[ service]
    //   all_services.push service # Can go anytime, but might need to be before someone else, so put first in list
    //   present[ service]= true
    // Add each service as late as possible (just before any known child(who depends on it))
    let tryList = [];
    for (let service of s2child) {
        if (!present.hasOwnProperty(service)) {
            tryList.push(service);
        }
    }
    let startLength = tryList.length;
    while (startLength === tryList.length) {
        startLength = tryList.length;
        // Place this service in front of all children if all are present
        for (let service in s2child) {
            if (present.hasOwnProperty(service))
                continue;
            let allPresent = true; // Assumption ???
            for (let child in s2child[service]) {
                if (present[child] === false) {
                    allPresent = false;
                    break;
                }
            }
            // Try again later
            if (allPresent)
                continue;
            // Find nearest neighbor
            if (s2child[service].length === 0) {
                // Can go on the end, eh?
                allServices.push(s2child[service]);
            }
            else {
                // Before child closest to the front
                const indexes = [];
                for (let child in s2child[service]) {
                    indexes.push(allServices.indexOf(child));
                }
                const lowestValue = min_1.default(indexes);
                // throw new Error f+"BROKEN LOGIC child=#{child}" if min < 0
                allServices.splice(lowestValue, 0, service);
            }
            present[service] = true;
        }
        tryList = [];
        for (let service in s2child) {
            if (!present.hasOwnProperty(service)) {
                tryList.push(service);
            }
        }
        //throw new Error f+"Some wierdness in dependancies" if try_list.length is start_length
        // TODO all_mods (based on both routes and services [and other mods?]
        // _log.debug f+'FINAL', {all_services,s2child}
        return [allServices, allMods];
    }
};
exports.default = start;
//# sourceMappingURL=index.js.map