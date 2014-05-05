#
# User Routes
#
# Author: Jamie Hollowell
#
# 	kit dependencies:
#		db.[mysql,mongo]
#		wrapper
#		logger.log
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
					push.GetPushSet ctx, false, "Prototype:#{mod.name}"
				.then (pset)=>
					kit.add_route_service mod.name, new PrototypeModule mod, pset
					wrapper.add mod.name
		q_result

class PrototypeModule
	constructor: (@mod, @pset)->
		f= "PrototypeModule:constructor:"
		@resource= {}
		@endpoints= {}

		for nm,dataset of @mod.datasets
			@resource[nm]= table: [], idx: {}, counter: 0
			@endpoints["get#{nm}"]=
				verb: 'get', route: "/Prototype/#{@mod.name}/#{nm}"
				use: true, wrap: 'read_wrap', version: any: @proto_wrap @_get, nm
				auth_required: @mod.auth_req
			@endpoints["get_by_id#{nm}"]=
				verb: 'get', route: "/Prototype/#{@mod.name}/#{nm}/:r0id"
				use: true, wrap: 'read_wrap', version: any: @proto_wrap @_get, nm
				auth_required: @mod.auth_req
			@endpoints["create#{nm}"]=
				verb: 'post', route: "/Prototype/#{@mod.name}/#{nm}"
				use: true, wrap: 'update_wrap', version: any: @proto_wrap @_create, nm
				sql_conn: false, auth_required: @mod.auth_req
			@endpoints["update#{nm}"]=
				verb: 'put', route: "/Prototype/#{@mod.name}/#{nm}/:r0id/update"
				use: true, wrap: 'update_wrap', version: any: @proto_wrap @_update, nm
				auth_required: @mod.auth_req
			@endpoints["delete#{nm}"]=
				verb: 'del', route: "/Prototype/#{@mod.name}/#{nm}/:r0id/delete"
				use: true, wrap: 'update_wrap', version: any: @proto_wrap @_delete, nm
				auth_required: @mod.auth_req

	proto_wrap: (func, resource)->
		return (ctx, pre_loaded)-> func ctx, pre_loaded, resource

	# Private Logic
	_get: (ctx, pre_loaded, resource)=>
		use_doc= {}
		return use_doc if ctx is 'use'
		p= 	  ctx.p
		conn= ctx.conn
		_log= ctx.log


		f= "Prototype:_get:#{@mod.name}:#{resource}:"
		r= @resource[resource]
		r0id= (Number p.r0id)
		result= {}

		if p.r0id
			throw new E.NotFoundError "PROTO:GET:#{@mod.name}:#{resource}:r0id" unless r0id of r.idx

		Q.resolve()
		.then =>

			# Load the record or table
			if p.r0id
				result[resource]= [ r.idx[r0id] ]
			else
				result[resource]= r.table
#				result.push_item= @pset.getItem()

			# Respond to Client
			result.success= true
			send: result

	# POST /Mod/Resource/:r0id
	_create: (ctx, pre_loaded, resource)=>
		use_doc= @mod.datasets[resource]
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
			r.table.push rec
			r.idx[rec.id]= rec
			result[resource]= [ rec ] # e.g. Item: [ {completed: 'yes', id: 1} ]

			# @pset.itemChange 0, 'add', {}, rec, rec.id, resource

			# Respond to Client
			result.success= true
			send: result

	_update: (ctx, pre_loaded, resource)=>
		use_doc= @mod.datasets[resource]
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

		q_result= Q.resolve true
		for r0id in batch_ids
			do (r0id)-> q_result= q_result.then () ->
				before= {}
				for nm of new_values
					before[nm]= r.idx[r0id][nm]

				# Update record
				r.idx[r0id]= _.merge r.idx[r0id], new_values
				result[resource]= [ r.idx[r0id] ] # e.g. Item: [ {completed: 'yes', id: 1} ]

				# Push the change
				#@pset.itemChange 0, 'change', before, new_values, rec.id, resource

		q_result
		.then ->

			# Respond to Client
			result.success= true
			send: result

	_delete: (ctx, pre_loaded, resource)=>
		use_doc= @mod.datasets[resource]
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
			do (r0id)-> q_result= q_result.then () ->
				# Delete record
				for item,idx in r.table when item.id is (Number r0id)
					before= _.clone item
					r.table.splice idx, 1
					break
				delete r.idx[r0id]

				# Push Item Change
				#@pset.itemChange conn, 0, 'delete', before, {}, rec.id, resource

		q_result
		.then ->

			# Respond to Client
			send: success: true

exports.Prototype= Prototype