#
#	Config Loader
#
#	Merges the Default Config for DVblueprint and Environment Config File.

fs= 		require 'fs'
path= 		require 'path'
_= 			require 'lodash'
config= 	require './default'

_log= console.log

fileExists= (filepath)->
	try
		fs.statSync filepath
	catch e
		return false
	true

module.exports= ()->
	env= 		process.env.npm_config_env ? 'container' # Default to Kyrio's docker-container based env injection
	configDir= 	process.env.npm_config_config_dir ? 'src/config'
	execDir= 	process.cwd()

	_log 'Environment specified:', env
	_log 'Config Dir specified:', configDir

	if configDir
		envPath= path.join execDir, configDir, env+ '.js'
		_log 'Env Config Path:', envPath
	if fileExists envPath
		_log 'Environment configuration found:', envPath
		_.merge config, require envPath
	else
		_log 'Environment specific configuration file not loaded. Using default configuration.'

	config.env= env
	config.processDir= execDir
	config
