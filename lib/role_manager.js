#
# 	Role Service
#

class RoleManager
	@deps= services: ['error',''], config: 'roles[role_def,permit_def,sift_def],route_prefix_length.api'
	constructor: (kit)->
		@config=	kit.services.config
		@E=			kit.services.error
		@role_def= 	 @config.roles.role_def
		@permit_def= @config.roles.permit_def
		@sift_def= 	 @config.roles.sift_def
		@lFunc= 	 @config.route_prefix_length.api

	# Assumes Default Wrapper
	SetCtx: (ctx, roleTk, resource_overide)->
		f= 'RoleManager:SetCtx:'
		ctx.log.debug f, roleTk, resource_overide
		ctx.role_def= @role_def[roleTk]
		ctx.resource= resource_overide ? ((( ctx.req.url.split '?')[0].slice @lFunc ctx.p.Version).split '/')[1]
		throw new @E.ServerError 'ROLEMGR:RESOURCE_NOT_IN_ROLEDEF', ctx.resource unless ctx.role_def[ctx.resource]
		permit_nm= ctx.role_def[ctx.resource].permit
		ctx.permit= if permit_nm is false then false else @permit_def[ctx.resource][permit_nm]

	# Validates that a resource for a role_def has a SIFT
	CheckSift: (ctx, resource)->
		f= 'RoleManager:CheckSift:'
		throw new @E.AccessDenied 'ROLE:SIFT:RESOURCE_NOT_IN_ROLEDEF', resource unless ctx.role_def[resource]
		throw new @E.AccessDenied 'ROLE:SIFT:RESOURCE_NOT_IN_SIFTDEF', resource unless @sift_def[resource]
		if ctx.role_def[resource].SIFT not in @sift_def[resource]
			throw new @E.AccessDenied 'ROLE:SIFT:SIFT_LIST'
		ctx.role_def[resource].SIFT

	CheckTalent: (ctx, roleTk, wanted_talent)->
		f= 'RoleManager:CheckTalent:'
		ctx.log.debug f, {roleTk, wanted_talent}
		throw new @E.AccessDenied f+'TALENT_LIST' unless wanted_talent in (@role_def[roleTk]?.talent ? [])

	GetTalentedRoles: (ctx, talent)->
		f= 'RoleManager:GetTalentedRoles:'
		ctx.log.debug f, talent
		talented_roles= []
		for role,def of @role_def
			talented_roles.push role if talent in (def.talent ? [])
		talented_roles

exports.RoleManager= RoleManager
