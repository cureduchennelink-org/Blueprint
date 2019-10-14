/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// EpicTemplate - server side templating based on EpicMvc
//
// Use:
//
// TODO: REWORK LOGIC TO ALLOW NON-SYNC FS CALL IN LOADER
//

const _log= console.log;

const window= {EpicMvc: {Extras: {}, Model: {}}};
const fs= require('fs');

class CookieCutterModel {
	constructor(Epic1,view_nm,init_table) {
		this.Epic = Epic1;
		this.view_nm = view_nm;
		this.init_table = init_table;
		this.Table= this.init_table;
	}
	getTable(tbl_nm) {
		return this.Table[tbl_nm];
	}
}

class Pageflow {
	constructor(){}
	getStepPath() { return ['a', 'B', 'c']; }
}

class Loader {
	constructor(view_path){
		this.view_path = view_path;
	}
	_load(type,nm) {
		const full_nm= (type === 'tmpl' ? '' : type+ '/')+ nm+ '.'+ type+ '.html';
		// TODO GET SYNC OUT OF THIS MODULE
		return window.EpicMvc.ParseFile(full_nm, fs.readFileSync(this.view_path+ '/'+ full_nm, 'utf8'));
	}
	template(nm) { return this._load('tmpl', nm); }
	page(nm) { return this._load('page', nm); }
}

class Epic {
	constructor(kit, model_map) {
		this.model_map = model_map;
		this.oAppConf= {getFrames() { return []; }};
		this.log1= (f, _a) => kit.services.logger.log.debug(f, ...Array.from(_a));
		this.log2= this.log1;
		this.counter= 1000;
		this.inst= {};
		this.tbl_data= {};
	}

	getInstance(model){
		if (!(model in this.model_map)) { throw new Error('EPIC_GETINSTANCE_'+ model); }
		if (this.inst[model] == null) {this.inst[model] = new (this.model_map[ model])(this, model, this.tbl_data[model]); }
		return this.inst[model];
	}

	destroyInstances(){ return this.inst= {}; }
	nextCounter(){ return this.counter++; }

	run(loader){
		this.loader = loader;
		return this.oView= new window.EpicMvc.ViewExe(this, this.loader, []); // Uses AppConf in constructor
	}
	getView() { return this.oView; }

	render(template, page){
		this.oView.init(template, page);
		const stuff= this.oView.run();
		return stuff;
	}

	addModel(model_name, klass, tbl_data){
		this.model_map[ model_name]= klass;
		if (tbl_data) { return this.tbl_data[ model_name ]= tbl_data; }
	}
}

class EpicTemplate {
	static initClass() {
		this.deps= {services: ['logger']};
	}
	constructor(kit, opts){
		const config= opts;
		this.log= kit.services.logger.log;
		(require('./parse.js'))(window);
		(require('./util.js'))(window);
		(require('./ViewExe.js'))(window);
		(require('./TagExe.js'))(window);

		const model_map= {Pageflow, Tag: window.EpicMvc.Model.TagExe$Base};
		const object = config.model_map != null ? config.model_map : {};
		for (let model_name in object) { const klass = object[model_name]; model_map[ model_name]= klass; }
		this.oEpic= new Epic(kit, model_map);

		const loader= new Loader(config.view_path != null ? config.view_path : 'config/view');
		this.oEpic.run(loader);

		window.EpicMvc.custom_filter= config.custom_filter;
	}

	render(model_name, template, page, tables) { //TODO CONSIDER ALLOWING MODELS TO BE MAPPED HERE - FOR EACH RENDER REQUEST
		const f= 'EpicTemplate:render:';
		this.log.debug(f, model_name, template, page);
		this.oEpic.addModel(model_name, CookieCutterModel, tables);
		const stuff= this.oEpic.render(template, page);
		this.oEpic.destroyInstances();
		return stuff;
	}
}
EpicTemplate.initClass();

exports.EpicTemplate= EpicTemplate;

