chai= 	require 'chai'
{Kit}= 	require  '../../lib/kit'

chai.should()

funcTarget= false

mockFunc= ()->
	funcTarget= true

class MockService
	@deps= {}
	constructor: (kit, opt)->
		@val= opt
		kit.services['mockFunc']()

class MockWrapper
	@deps= {}
	constructor: (kit, opts)->

class MockRoute
	@deps= {}
	constructor: (kit, opts)->
		@val= opts ? false
		kit.services['mockFunc']()

describe 'Kit', ()->
	kit= new Kit

	it 'should have a place to store services and routes', ()->
		kit.should.have.property 'services'
		kit.should.have.property 'routes'
		kit.should.respondTo 'add_service'
		kit.should.respondTo 'new_service'
		kit.should.respondTo 'add_route_service'
		kit.should.respondTo 'new_route_service'

	it 'should add a function or object to services', ()->
		kit.add_service 'my_object', p1: 1, p2:2
		kit.services.should.have.property 'my_object'
		kit.services.my_object.p1.should.equal 1
		kit.add_service 'mockFunc', mockFunc
		kit.services['mockFunc']()
		funcTarget.should.be.true

	it 'should create a new instance and add to services', ()->
		funcTarget= false
		funcTarget.should.be.false
		kit.new_service 'my_service', MockService, ['my_arg']
		kit.services.my_service.should.be.an.instanceof MockService
		kit.services.my_service.val.should.equal 'my_arg'
		funcTarget.should.be.true

	it 'should create a new route instance and add to routes', ()->
		funcTarget= false
		funcTarget.should.be.false
		kit.new_service 'wrapper', MockWrapper, ['my_arg']
		kit.new_route_service 'my_route', MockRoute, ['my_arg']
		kit.routes.my_route.should.be.an.instanceof MockRoute
		kit.routes.my_route.val.should.equal 'my_arg'
		funcTarget.should.be.true
