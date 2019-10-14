// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Route Pre-Loader
//

const log_map= {
	get:  'GET ',
	post: 'POST',
	put:  'PUT ',
	del:  'DEL '
};

const use_map= {
	get:  'GET',
	post: 'POST',
	put:  'PUT',
	del:  'DEL'
};

class Router {
	static initClass() {
		this.deps = {services: ['template_use', 'server'], config: 'route_prefix.api'};
	}
	constructor(kit) {
		this.server_init = this.server_init.bind(this);
		this.log= 		kit.services.logger.log;
		this.pfx= 		kit.services.config.route_prefix.api;
		this.template= 	kit.services.template_use;
		this.server= 	kit.services.server.server;
		this.usage= [];
		this.usage_by_mod= {};
	}

	AddRoute(mod, name, verb, route, func){
		let nm, val;
		if (!this.usage_by_mod[mod]) { this.usage_by_mod[mod]= []; }
		const use_spec= func('use');
		const use_rec= {
			name,
			verb: use_map[verb],
			route,
			Param: (((() => {
				const result = [];
				for (nm in use_spec.params) {
					val = use_spec.params[nm];
					result.push({name: nm, format: val});
				}
				return result;
			})())),
			Response: (((() => {
				const result1 = [];
				for (nm in use_spec.response) {
					val = use_spec.response[nm];
					result1.push({name: nm, format: val});
				}
				return result1;
			})()))
		};
		this.usage_by_mod[mod].push(use_rec);
		this.usage.push(use_rec);
		const verbs= [verb];
		if (['del','put'].includes(verb)) { verbs.push('post'); }
		return (() => {
			const result2 = [];
			for (let v of Array.from(verbs)) {
				this.log.info('\t', log_map[v], this.pfx + '' + route);
				result2.push(this.server[v](this.pfx + '' + route, func));
			}
			return result2;
		})();
	}

	make_tbl(){
		const table= {Module: []};
		for (let mod in this.usage_by_mod) {
			const route_list = this.usage_by_mod[mod];
			table.Module.push({name: mod, Route: ((Array.from(route_list)))});
		}
		return table;
	}

	server_init(){
		const f= 'Router:server_init';
		return this.server['get'](this.pfx, (q,r,n)=> {
			if (q.params.format === 'json') {
				r.send(this.usage);
			} else {
				let body;
				try {
					body= this.template.render('Usage','Usage','usage_main', this.make_tbl());
				} catch (e) {
					this.log.debug(e, e.stack);
					throw e;
				}
				r.writeHead(200, {
					'Content-Length': Buffer.byteLength(body),
					'Content-Type': 'text/html; charset=utf-8'
				}
				);
				r.write(body);
				r.end();
			}
			return n();
		});
	}
}
Router.initClass();

exports.Router= Router;
