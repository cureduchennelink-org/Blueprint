#
# EpicTemplate - server side templating based on EpicMvc
#
# Use:
#
# TODO: REWORK LOGIC TO ALLOW NON-SYNC FS CALL IN LOADER
#

_log= console.log

window= EpicMvc: Extras: {}, Model: {}
fs= require 'fs'

class CookieCutterModel
	constructor: (@Epic,@view_nm,@init_table) ->
		@Table= @init_table
	getTable: (tbl_nm) ->
		@Table[tbl_nm]

class Pageflow
	constructor: ()->
	getStepPath: -> ['a', 'B', 'c']

class Loader
	constructor: (@view_path)->
	_load: (type,nm) ->
		full_nm= (if type is 'tmpl' then '' else type+ '/')+ nm+ '.'+ type+ '.html'
		# TODO GET SYNC OUT OF THIS MODULE
		window.EpicMvc.ParseFile full_nm, fs.readFileSync @view_path+ '/'+ full_nm, 'utf8'
	template: (nm) -> @_load 'tmpl', nm
	page: (nm) -> @_load 'page', nm

class Epic
	constructor: (kit, @model_map) ->
		@oAppConf= getFrames: -> []
		@log1= (f, _a)-> kit.services.logger.log.debug f, _a...
		@log2= @log1
		@counter= 1000
		@inst= {}
		@tbl_data= {}

	getInstance: (model)->
		throw new Error 'EPIC_GETINSTANCE_'+ model if model not of @model_map
		@inst[model]?= new @model_map[ model] @, model, @tbl_data[model]
		return @inst[model]

	destroyInstances: ()-> @inst= {}
	nextCounter: ()-> @counter++

	run: (@loader)->
		@oView= new window.EpicMvc.ViewExe @, @loader, [] # Uses AppConf in constructor
	getView: -> @oView

	render: (template, page)->
		@oView.init template, page
		stuff= @oView.run()
		return stuff

	addModel: (model_name, klass, tbl_data)->
		@model_map[ model_name]= klass
		@tbl_data[ model_name ]= tbl_data if tbl_data

class EpicTemplate
	@deps= services: ['logger']
	constructor: (kit, opts)->
		config= opts
		@log= kit.services.logger.log
		(require './parse.js') window
		(require './util.js') window
		(require './ViewExe.js') window
		(require './TagExe.js') window

		model_map= Pageflow: Pageflow, Tag: window.EpicMvc.Model.TagExe$Base
		model_map[ model_name]= klass for model_name,klass of config.model_map ? {}
		@oEpic= new Epic kit, model_map

		loader= new Loader config.view_path ? 'config/view'
		@oEpic.run loader

		window.EpicMvc.custom_filter= config.custom_filter

	render: (model_name, template, page, tables) -> #TODO CONSIDER ALLOWING MODELS TO BE MAPPED HERE - FOR EACH RENDER REQUEST
		f= 'EpicTemplate:render:'
		@log.debug f, model_name, template, page
		@oEpic.addModel(model_name, CookieCutterModel, tables)
		stuff= @oEpic.render template, page
		@oEpic.destroyInstances()
		stuff

exports.EpicTemplate= EpicTemplate

