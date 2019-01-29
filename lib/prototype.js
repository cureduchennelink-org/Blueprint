/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Prototype Route Service
//

const Q= require('q');
const E= require('../lib/error');
const _= require('lodash');

let _log= false;

class Prototype {
	constructor(kit){
		const f= 'Prototype:constructor';
		this.log= 		kit.services.logger.log;
		this.config= 	kit.services.config.prototype;
	}

	// optional server_init func
	// Runs before server starts listening
	server_init(kit){
		const f= 'Prototype:server_init:';
		const { push }=		kit.services;
		const { wrapper }=	kit.services;
		const protos=		this.config.modules;
		const clear_pset= this.config.clear_psets_on_restart;

		let q_result= Q.resolve(true);
		for (let mod of Array.from(protos)) {
			if (mod.enable) {
				(mod=> {
					return q_result= q_result.then(() => {
						// Initiate the Push Set
						const ctx= {conn: null, log: this.log};
						return push.GetPushSet(ctx, clear_pset, `Prototype/${mod.name}`);
				}).then(pset=> {
						kit.add_route_service(mod.name, new PrototypeModule(mod, pset));
						return wrapper.add(mod.name);
					});
				})(mod);
			}
		}
		return q_result;
	}
}

class PrototypeModule {
	constructor(mod, pset){
		this.S_Get = this.S_Get.bind(this);
		this.S_Create = this.S_Create.bind(this);
		this.S_Update = this.S_Update.bind(this);
		this.S_Delete = this.S_Delete.bind(this);
		this.mod = mod;
		this.pset = pset;
		const f= "PrototypeModule:constructor:";
		this.resource= {};
		this.endpoints= {};

		this.endpoints[`get${this.mod.name}`]= {
			verb: 'get', route: `/Prototype/${this.mod.name}`,
			use: true, wrap: 'default_wrap', version: { any: this.S_Get
		},
			sql_conn: true, sql_tx: true, auth_required: this.mod.auth_req
		};

		for (let nm in this.mod.datasets) {
			const dataset = this.mod.datasets[nm];
			const idx= {};
			let counter= 0;
			for (let rec of Array.from((this.mod.data != null ? this.mod.data[nm] : undefined) != null ? (this.mod.data != null ? this.mod.data[nm] : undefined) : [])) {
				idx[(rec.id= counter++)]= rec;
			}
			this.resource[nm]= { idx, counter };
			this.endpoints[`create${nm}`]= {
				verb: 'post', route: `/Prototype/${this.mod.name}/${nm}`,
				use: true, wrap: 'default_wrap', version: { any: this.proto_wrap(this.S_Create, nm)
			},
				sql_conn: true, sql_tx: true, auth_required: this.mod.auth_req
			};
			this.endpoints[`update${nm}`]= {
				verb: 'put', route: `/Prototype/${this.mod.name}/${nm}/:r0id/update`,
				use: true, wrap: 'default_wrap', version: { any: this.proto_wrap(this.S_Update, nm)
			},
				sql_conn: true, sql_tx: true, auth_required: this.mod.auth_req
			};
			this.endpoints[`delete${nm}`]= {
				verb: 'del', route: `/Prototype/${this.mod.name}/${nm}/:r0id/delete`,
				use: true, wrap: 'default_wrap', version: { any: this.proto_wrap(this.S_Delete, nm)
			},
				sql_conn: true, sql_tx: true, auth_required: this.mod.auth_req
			};
		}
	}

	proto_wrap(func, resource){
		return (ctx, pre_loaded)=> func(ctx, pre_loaded, resource);
	}

	// Private Logic
	S_Get(ctx, pre_loaded){
		let nm;
		const use_doc= {params: {}, response: {success: 'bool', push: 'string'}};
		for (nm in this.resource) { use_doc.response[nm]= 'list'; }
		if (ctx === 'use') { return use_doc; }
		const f= `Prototype:S_Get:${this.mod.name}:`;
		_log= ctx.log;
		const result= {};
		result[this.mod.name]= {};

		return Q.resolve()
		.then(()=> {

			for (nm in this.resource) {
				const r_obj = this.resource[nm];
				result[this.mod.name][nm]= [];
				for (let id in r_obj.idx) { const rec = r_obj.idx[id]; result[this.mod.name][nm].push(rec); }
			}

			// Load the Push Set Handle
			return this.pset.GetPushHandle(ctx, 0);
	}).then(function(push_handle){
			result.push_handle= push_handle;

			// Respond to Client
			result.success= true;
			return {send: result};
		});
	}

	// POST /Mod/Resource/:r0id
	S_Create(ctx, pre_loaded, resource){
		const use_doc= {
			params: this.mod.datasets[resource],
			response: { success: 'bool'
		}
		};
		use_doc.response[resource]= 'list';
		if (ctx === 'use') { return use_doc; }
		const { p }= 	  ctx;
		const { conn }= ctx;
		_log= ctx.log;

		const f= `Prototype:S_Create:${this.mod.name}:${resource}:`;
		const r= this.resource[resource];
		const schema= this.mod.datasets[resource];
		const rec= {};
		const result= {};

		// Validate all schema columns are included in params
		for (let col in schema) {
			if (!(col in p)) { throw new E.MissingArg(col); }
			rec[col]= p[col];
		}
		rec.id= r.counter++;

		return Q.resolve()
		.then(()=> {

			// Create new record
			r.idx[rec.id]= rec;
			result[resource]= [ rec ]; // e.g. Item: [ {completed: 'yes', id: 1} ]

			// Notify Push Set of Item Change
			return this.pset.ItemChange(ctx, 0, 'add', {}, rec, resource, rec.id, null);
	}).then(()=> {

			// Respond to Client
			result.success= true;
			return {send: result};
		});
	}

	S_Update(ctx, pre_loaded, resource){
		let batch_ids, nm, r0id;
		let id;
		const use_doc= {
			params: this.mod.datasets[resource],
			response: { success: 'bool'
		}
		};
		use_doc.response[resource]= 'list';
		if (ctx === 'use') { return use_doc; }
		const { p }= 	  ctx;
		const { conn }= ctx;
		_log= ctx.log;

		const f= `Prototype:S_Update:${this.mod.name}:${resource}:`;
		const r= this.resource[resource];
		const schema= this.mod.datasets[resource];
		const new_values= {};
		const result= {};

		if (p.r0id === 'batch') {
			if (!('batch_ids' in p)) { throw new E.MissingArg('batch_ids'); }
			batch_ids= ((() => {
				const result1 = [];
				 for (id of Array.from(p.batch_ids)) { 					result1.push((Number(id)));
				} 
				return result1;
			})());
		} else {
			batch_ids= [ (Number(p.r0id)) ];
		}

		// Validate all params are part of the resource schema (excluding resource Id's)
		for (nm in p) {
			const val = p[nm];
			if (nm in schema) {
				new_values[nm]= val;
			}
		}

		// Validate that r0id exists
		for (r0id of Array.from(batch_ids)) {
			if (!(r0id in r.idx)) { throw new E.NotFoundError(`PROTO:UPDATE:${this.mod.name}:${resource}:r0id`); }
		}

		result[resource]= [];
		let q_result= Q.resolve(true);
		for (r0id of Array.from(batch_ids)) {
			(r0id=> { return q_result= q_result.then(() => {
				const before= {};
				for (nm in new_values) {
					before[nm]= r.idx[r0id][nm];
				}

				// Update record
				r.idx[r0id]= _.merge(r.idx[r0id], new_values);
				result[resource].push(r.idx[r0id]); // e.g. Item: [ {completed: 'yes', id: 1}, ... ]

				// Notify Push Set of Item Change
				let vals= _.clone(new_values);
				vals= _.merge(vals, {id: r0id});
				return this.pset.ItemChange(ctx, 0, 'update', before, vals, resource, r0id, null);
			}); })(r0id);
		}
		return q_result
		.then(function() {

			// Respond to Client
			result.success= true;
			return {send: result};
		});
	}

	S_Delete(ctx, pre_loaded, resource){
		let batch_ids, r0id;
		const use_doc=
			{params: {}, response: {success: 'bool'}};
		if (ctx === 'use') { return use_doc; }
		const { p }= 	  ctx;
		const { conn }= ctx;
		_log= ctx.log;

		const f= `Prototype:S_Delete:${this.mod.name}:${resource}:`;
		const r= this.resource[resource];
		const before= {};

		if (p.r0id === 'batch') {
			batch_ids= ( Array.from(p.batch_ids).map((id) => (Number(id))) );
			if (!batch_ids.length) { throw new E.MissingArg('batch_ids'); }
		} else {
			batch_ids= [ (Number(p.r0id)) ];
		}

		// Validate that r0id or batch ids exist
		for (r0id of Array.from(batch_ids)) {
			if (!(r0id in r.idx)) { throw new E.NotFoundError(`PROTO:DELETE:${this.mod.name}:${resource}:r0id`, r0id); }
		}

		let q_result= Q.resolve(true);
		for (r0id of Array.from(batch_ids)) {
			(r0id=> { return q_result= q_result.then(() => {
				// Delete record
				delete r.idx[`${r0id}`];

				// Notify Push Set of Item Change
				return this.pset.ItemChange(ctx, 0, 'delete', before, {}, resource, r0id, null);
			}); })(r0id);
		}
		return q_result
		.then(() =>

			// Respond to Client
			({send: {success: true}})
		);
	}
}

exports.Prototype= Prototype;