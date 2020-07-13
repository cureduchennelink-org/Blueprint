// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// 	Event emitter to allow user modules to hook into blueprint provided functionality
//
const {EventEmitter}= require('events');

class Event extends EventEmitter {
	static deps() {
		return {};
	}
	constructor(kit){
		super()
		this.log= kit.services.logger.log;
	}
}

exports.Event= Event;
