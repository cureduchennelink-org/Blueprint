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
		kit.services.logger.log.info 'Initializing Prototype Routes...'
		#
		_log= 		kit.services.logger.log
		@protos= 	kit.services.config.prototype_modules
		@wrapper= 	kit.services.wrapper
		@wrapper.add_wrap 'prototype', @add # Register Prototype wrapper w/ Kit Wrapper Service

		# Create and Register all Prototype modules with the Kit
		for mod in @protos when mod.enable
			kit.add_route_service mod.name, new PrototypeModule mod

	# Prototype wrapper
	add: (mod_prototype)=>
		for mod in @protos when mod.enable
			@wrapper.add mod.name

class PrototypeModule
	constructor: (@mod)->
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
		return (conn, p, pre_loaded, _log)-> func conn, p, pre_loaded, _log, resource

	# Private Logic
	_get: (conn, p, pre_loaded, _log, resource)=>
		use_doc= {}
		return use_doc if conn is 'use'

		f= "Prototype:_get:#{@mod.name}:#{resource}:"
		r= @resource[resource]
		r0id= (Number p.r0id)
		result= {}

		if p.r0id
			throw new E.NotFoundError "PROTO:GET:#{@mod.name}:#{resource}:r0id" unless r0id of r.idx

		Q.resolve()
		.then =>

			# Load the record or table
			result[resource]= if p.r0id
			then [ r.idx[r0id] ]
			else r.table

			# Respond to Client
			result.success= true
			send: result

	_create: (conn, p, pre_loaded, _log, resource)=>
		use_doc= @mod.datasets[resource]
		return use_doc if conn is 'use'

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
			result[resource]= [ rec ]

			# Respond to Client
			result.success= true
			send: result

	_update: (conn, p, pre_loaded, _log, resource)=>
		use_doc= @mod.datasets[resource]
		return use_doc if conn is 'use'

		f= "Prototype:_update:#{@mod.name}:#{resource}:"
		r= @resource[resource]
		schema= @mod.datasets[resource]
		new_values= {}
		result= {}

		# Validate all params are part of the resource schema (excluding resource Id's)
		new_values[nm]= val for nm,val of p when nm of schema

		Q.resolve()
		.then =>

			# Validate that r0id exists
			throw new E.NotFoundError "PROTO:UPDATE:#{@mod.name}:#{resource}:r0id" unless p.r0id of r.idx

			# Update record
			r.idx[p.r0id]= _.merge r.idx[p.r0id], new_values
			result[resource]= r.idx[p.r0id]

			# Respond to Client
			result.success= true
			send: result

	_delete: (conn, p, pre_loaded, _log, resource)=>
		use_doc= @mod.datasets[resource]
		return use_doc if conn is 'use'

		f= "Prototype:_update:#{@mod.name}:#{resource}:"
		r= @resource[resource]

		Q.resolve()
		.then ->

			# Validate that r0id exists
			throw new E.NotFoundError "PROTO:DELETE:#{@mod.name}:#{resource}:r0id" unless p.r0id of r.idx

			# Delete record
			delete r.idx[p.r0id]

			# Respond to Client
			send: success: true


exports.Prototype= Prototype