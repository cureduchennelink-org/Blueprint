// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// Kit Object. Dependency Manager
//
// Author: Jamie Hollowell
//
let _log= {debug: console.log}; // Until a logger service is added

class Kit {
	constructor(){
		this.new_service = this.new_service.bind(this);
		this.services= {};
		this.routes= {};
	}

	get_service_deps_needed(name, constructor){ // Look at deps.services and remove any already in @services
		const f= 'Kit::get_service_deps_needed: ';
		_log.debug( f, {name, constructor});
		const d= constructor.deps();
		if (!d) { throw new Error(f+ `Module '${name}' is missing @deps - `+ JSON.stringify(constructor)); }
		const needed= [];
		for (let nm of Array.from((d.services || []))) {
			if (!(nm in this.services)) { needed.push(nm); }
		}
		if (d.mysql || d.mongo) { needed.push('db'); }
		return needed;
	}

	add_service(name, obj){
		this.services[ name]= obj;
		if (name === 'logger') { _log= this.services[ name].log; }
		return this.services[ name];
	}

	new_service(name, constructor, args){
		const f= 'Kit::new_service: ';
		_log.debug( f, {name,constructor});
		const d= constructor.deps();
		if (!d) { throw new Error(f+ `Service-Module '${name}' is missing @deps`); }
		const needs= d.services != null ? d.services : [];
		if (d.mysql || d.mongo) { needs.push('db'); }
		for (let n of Array.from(needs)) { if (!(n in this.services)) { throw new Error(f+ `Service-Module '${name}' requires service '${n}'`); } }
		const _t= this;
		const _a= args != null ? args : [];
		this.services[ name]= new constructor(_t, ...Array.from(_a));
		if (name === 'logger') { _log= this.services[ name].log; }
		return this.services[ name];
	}

	add_route_service(name, obj){
		return this.routes[name]= obj;
	}

	new_route_service(name, constructor, args){
		const f= 'Kit::new_route_service: ';
		_log.debug( f, {name,constructor});
		const d= constructor.deps();
		if (!d) { throw new Error(f+ `Route-Module '${name}' is missing @deps`); }
		const needs= d.services != null ? d.services : [];
		needs.push('wrapper');
		for (let n of Array.from(needs)) { if (!(n in this.services)) { throw new Error(f+ `Route-Module '${name}' requires service '${n}'`); } }
		const _t= this;
		const _a= args != null ? args : [];
		return this.routes[name]= new constructor(_t, ...Array.from(_a));
	}
}

exports.Kit= Kit;
