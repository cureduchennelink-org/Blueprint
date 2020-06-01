#
# 	Event emitter to allow user modules to hook into blueprint provided functionality
#
{EventEmitter}= require 'events'

class Event extends EventEmitter
	@deps= {}
	constructor: (kit)->
		@log= kit.services.logger.log

exports.Event= Event
