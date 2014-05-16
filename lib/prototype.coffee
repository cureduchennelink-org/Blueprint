#
# Prototype Route Service
#

Q= require 'q'
E= require '../lib/error'
_= require 'lodash'

_log= false

class Prototype
	constructor: (kit)->
		f= 'Prototype:constructor'
		@log= kit.services.logger.log
		@log.info 'Initializing Prototype...'

	# optional server_init func
	# Runs before server starts listening
	server_init: (kit)->
		f= 'Prototype:server_init:'
		push=		kit.services.push
		wrapper=	kit.services.wrapper
		protos=		kit.services.config.prototype.modules

		q_result= Q.resolve true
		for mod in protos when mod.enable
			do(mod)=>
				q_result= q_result.then =>
					# Initiate the Push Set
					ctx= conn: null, log: @log
					push.GetPushSet ctx, true, "Prototype/#{mod.name}"
				.then (pset)=>
					kit.add_route_service mod.name, new PrototypeModule mod, pset
					wrapper.add mod.name
		q_result

class PrototypeModule
	constructor: (@mod, @pset)->
		f= "PrototypeModule:constructor:"
		@resource= {}
		@endpoints= {}

		@endpoints["get#{@mod.name}"]=
			verb: 'get', route: "/Prototype/#{@mod.name}"
			use: true, wrap: 'default_wrap', version: any: @_get
			sql_conn: true, sql_tx: true, auth_required: @mod.auth_req
		
		for nm,dataset of @mod.datasets
			@resource[nm]= idx: {}, counter: 0
			@endpoints["create#{nm}"]=
				verb: 'post', route: "/Prototype/#{@mod.name}/#{nm}"
				use: true, wrap: 'default_wrap', version: any: @proto_wrap @_create, nm
				sql_conn: true, sql_tx: true, auth_required: @mod.auth_req
			@endpoints["update#{nm}"]=
				verb: 'put', route: "/Prototype/#{@mod.name}/#{nm}/:r0id/update"
				use: true, wrap: 'default_wrap', version: any: @proto_wrap @_update, nm
				sql_conn: true, sql_tx: true, auth_required: @mod.auth_req
			@endpoints["delete#{nm}"]=
				verb: 'del', route: "/Prototype/#{@mod.name}/#{nm}/:r0id/delete"
				use: true, wrap: 'default_wrap', version: any: @proto_wrap @_delete, nm
				sql_conn: true, sql_tx: true, auth_required: @mod.auth_req

	proto_wrap: (func, resource)->
		return (ctx, pre_loaded)-> func ctx, pre_loaded, resource

	# Private Logic
	_get: (ctx, pre_loaded)=>
		use_doc= params: {}, response: success: 'bool', push: 'string'
		use_doc.response[nm]= 'list' for nm of @resource
		return use_doc if ctx is 'use'
		_log= ctx.log


		f= "Prototype:_get:#{@mod.name}:"
		result= {}

		Q.resolve()
		.then =>

			for nm, r_obj of @resource
				result[nm]= []
				result[nm].push rec for id,rec of r_obj.idx
			
			# Load the Push Set Handle
			@pset.getPushHandle ctx, 0
		.then (push_handle)->
			result.push= push_handle

			# Respond to Client
			result.success= true
			send: result

	# POST /Mod/Resource/:r0id
	_create: (ctx, pre_loaded, resource)=>
		use_doc= 
			params: @mod.datasets[resource]
			response: success: 'bool'
		use_doc.response[resource]= 'list'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		f= "Prototype:_create:#{@mod.name}:#{resource}:"
		r= @resource[resource]
		schema= @mod.datasets[resource]
		rec= {}
		result= {}

		# Validate all schema columns are included in params
		for col of schema
			throw new E.MissingArg col unless col of p
			rec[col]= p[col]
		rec.id= r.counter++

		Q.resolve()
		.then =>

			# Create new record
			r.idx[rec.id]= rec
			result[resource]= [ rec ] # e.g. Item: [ {completed: 'yes', id: 1} ]

			# Notify Push Set of Item Change
			@pset.itemChange ctx, 0, 'add', {}, rec, resource, rec.id, null
		.then =>

			# Respond to Client
			result.success= true
			send: result

	_update: (ctx, pre_loaded, resource)=>
		use_doc= 
			params: @mod.datasets[resource]
			response: success: 'bool'
		use_doc.response[resource]= 'list'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		f= "Prototype:_update:#{@mod.name}:#{resource}:"
		r= @resource[resource]
		schema= @mod.datasets[resource]
		new_values= {}
		result= {}

		if p.r0id is 'batch'
			batch_ids= ( (Number id) for id in p.batch_ids )
			throw new E.MissingArg 'batch_ids' unless batch_ids.length
		else
			batch_ids= [ (Number p.r0id) ]

		# Validate all params are part of the resource schema (excluding resource Id's)
		for nm,val of p when nm of schema
			new_values[nm]= val

		# Validate that r0id exists
		for r0id in batch_ids
			throw new E.NotFoundError "PROTO:UPDATE:#{@mod.name}:#{resource}:r0id" unless r0id of r.idx

		result[resource]= []
		q_result= Q.resolve true
		for r0id in batch_ids
			do (r0id)=> q_result= q_result.then () =>
				before= {}
				for nm of new_values
					before[nm]= r.idx[r0id][nm]

				# Update record
				r.idx[r0id]= _.merge r.idx[r0id], new_values
				result[resource].push r.idx[r0id] # e.g. Item: [ {completed: 'yes', id: 1}, ... ]

				# Notify Push Set of Item Change
				vals= _.clone new_values
				vals= _.merge vals, id: r0id
				@pset.itemChange ctx, 0, 'update', before, vals, resource, r0id, null
			.then => # TODO: Have itemChange return what the push service would
		q_result
		.then ->

			# Respond to Client
			result.success= true
			send: result

	_delete: (ctx, pre_loaded, resource)=>
		use_doc=
			params: {}, response: success: 'bool'
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log

		f= "Prototype:_delete:#{@mod.name}:#{resource}:"
		r= @resource[resource]
		before= {}

		if p.r0id is 'batch'
			batch_ids= ( (Number id) for id in p.batch_ids )
			throw new E.MissingArg 'batch_ids' unless batch_ids.length
		else
			batch_ids= [ (Number p.r0id) ]

		# Validate that r0id or batch ids exist
		for r0id in batch_ids
			throw new E.NotFoundError "PROTO:DELETE:#{@mod.name}:#{resource}:r0id", r0id unless r0id of r.idx

		q_result= Q.resolve true
		for r0id in batch_ids
			do (r0id)=> q_result= q_result.then () =>
				# Delete record
				delete r.idx["#{r0id}"]

				# Notify Push Set of Item Change
				@pset.itemChange ctx, 0, 'delete', before, {}, resource, r0id, null
			.then ->
		q_result
		.then ->

			# Respond to Client
			send: success: true

exports.Prototype= Prototype