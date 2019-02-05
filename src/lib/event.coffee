#
# 	Event emitter to allow user modules to hook into blueprint provided functionality
#
{EventEmitter}= require 'events'

# TODO: Ask James what is going on here

class Event extends EventEmitter
	@deps= {}
	constructor: (kit)->
		@log= kit.services.logger.log

exports.Event= Event
