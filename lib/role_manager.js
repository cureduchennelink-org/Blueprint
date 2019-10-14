/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// 	Role Service
//

class RoleManager {
	static initClass() {
		this.deps= {services: ['error',''], config: 'roles[role_def,permit_def,sift_def],route_prefix_length.api'};
	}
	constructor(kit){
		this.config=	kit.services.config;
		this.E=			kit.services.error;
		this.role_def= 	 this.config.roles.role_def;
		this.permit_def= this.config.roles.permit_def;
		this.sift_def= 	 this.config.roles.sift_def;
		this.lFunc= 	 this.config.route_prefix_length.api;
	}

	// Assumes Default Wrapper
	SetCtx(ctx, roleTk, resource_overide){
		const f= 'RoleManager:SetCtx:';
		ctx.log.debug(f, roleTk, resource_overide);
		ctx.role_def= this.role_def[roleTk];
		ctx.resource= resource_overide != null ? resource_overide : ((( ctx.req.url.split('?'))[0].slice(this.lFunc(ctx.p.Version))).split('/'))[1];
		if (!ctx.role_def[ctx.resource]) { throw new this.E.ServerError('ROLEMGR:RESOURCE_NOT_IN_ROLEDEF', ctx.resource); }
		const permit_nm= ctx.role_def[ctx.resource].permit;
		return ctx.permit= permit_nm === false ? false : this.permit_def[ctx.resource][permit_nm];
	}

	// Validates that a resource for a role_def has a SIFT
	CheckSift(ctx, resource){
		const f= 'RoleManager:CheckSift:';
		if (!ctx.role_def[resource]) { throw new this.E.AccessDenied('ROLE:SIFT:RESOURCE_NOT_IN_ROLEDEF', resource); }
		if (!this.sift_def[resource]) { throw new this.E.AccessDenied('ROLE:SIFT:RESOURCE_NOT_IN_SIFTDEF', resource); }
		if (!Array.from(this.sift_def[resource]).includes(ctx.role_def[resource].SIFT)) {
			throw new this.E.AccessDenied('ROLE:SIFT:SIFT_LIST');
		}
		return ctx.role_def[resource].SIFT;
	}

	CheckTalent(ctx, roleTk, wanted_talent){
		const f= 'RoleManager:CheckTalent:';
		ctx.log.debug(f, {roleTk, wanted_talent});
		if (!Array.from((this.role_def[roleTk] != null ? this.role_def[roleTk].talent : undefined) != null ? (this.role_def[roleTk] != null ? this.role_def[roleTk].talent : undefined) : []).includes(wanted_talent)) { throw new this.E.AccessDenied(f+'TALENT_LIST'); }
	}

	GetTalentedRoles(ctx, talent){
		const f= 'RoleManager:GetTalentedRoles:';
		ctx.log.debug(f, talent);
		const talented_roles= [];
		for (let role in this.role_def) {
			const def = this.role_def[role];
			if (Array.from(def.talent != null ? def.talent : []).includes(talent)) { talented_roles.push(role); }
		}
		return talented_roles;
	}
}
RoleManager.initClass();

exports.RoleManager= RoleManager;
