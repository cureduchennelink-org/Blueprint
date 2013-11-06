/**
 * Config File MNC
 */

var fs = require('fs')
    , path = require('path')
    , _ = require('lodash');

var fileExists = function(filepath) {
    try {
        fs.statSync(filepath);
    } catch(e) {
        return false;
    }
    return true;
};

module.exports = function(env, configDir) {
    if (!env) {
        env = process.env.npm_config_env || process.env.npm_config_platform;

        if (!env) {
            throw new Error('You must specify an environment. (E.g., "npm start --env integration")');
        }
    }

    if (!configDir) {
        configDir = process.env.npm_config_config_dir || path.resolve(__dirname, '../config');
    }
    console.info('Loading configuration for environment "%s" from %s', env, configDir);

    var defaultPath = path.join(configDir, 'default.js');
    var config = {};
    if (fileExists(defaultPath)) {
        console.info('Loading default configuration file %s', defaultPath);
        config = require(defaultPath);
    } else {
        console.warn("Default configuration file %s not found", defaultPath);
    }

    var envPath = path.join(configDir, env + '.js');
    if (fileExists(envPath)) {
        console.info('Merging environment configuration file %s', envPath);
        _.merge(config, require(envPath));
    } else {
        console.info('No environment-specific configuration file found.');
    }

    if (Object.getOwnPropertyNames(config).length == 0) {
        throw new Error("No configuration settings loaded. Check your configuration directory, files, and environment settings.")
    }
    config.env = env;
    return config;
};