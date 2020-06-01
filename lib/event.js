/*
 * decaffeinate suggestions:
 * DS001: Remove Babel/TypeScript constructor workaround
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// 	Event emitter to allow user modules to hook into blueprint provided functionality
//
const {EventEmitter}= require('events');

class Event extends EventEmitter {
	static initClass() {
		this.deps= {};
	}
	constructor(kit){
		{
		  // Hack: trick Babel/TypeScript into allowing this before super.
		  if (false) { super(); }
		  let thisFn = (() => { return this; }).toString();
		  let thisName = thisFn.match(/return (?:_assertThisInitialized\()*(\w+)\)*;/)[1];
		  eval(`${thisName} = this;`);
		}
		this.log= kit.services.logger.log;
	}
}
Event.initClass();

exports.Event= Event;
