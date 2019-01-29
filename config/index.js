/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Config Loader
//
//	Merges the Default Config for DVblueprint and Environment Config File.

const fs= 		require('fs');
const path= 		require('path');
const _= 			require('lodash');
const config= 	require('./default');

const _log= console.log;

const fileExists= function(filepath){
	try {
		fs.statSync(filepath);
	} catch (e) {
		return false;
	}
	return true;
};

module.exports= function(){
	let envPath;
	const env= 		process.env.npm_config_env;
	const configDir= 	process.env.npm_config_config_dir;
	const execDir= 	process.cwd();

	_log('Environment specified:', env);
	_log('Config Dir specified:', configDir);

	if (configDir) {
		envPath= path.join(execDir, configDir, env+ '.js');
		_log('Env Config Path:', envPath);
	}
	if (fileExists(envPath)) {
		_log('Environment configuration found:', envPath);
		_.merge(config, require(envPath));
	} else {
		_log('Environment specific configuration file not loaded. Using default configuration.');
	}

	config.env= env;
	config.processDir= execDir;
	return config;
};