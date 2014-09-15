chai= require 'chai'
chai.should()

describe 'My Second Test', ()->
	
	it 'should return true', ()->
		x= true
		x.should.equal true