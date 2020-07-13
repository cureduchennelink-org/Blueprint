// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// 	Utility Functions / Object
//

const _= require('lodash');

class Util {
	static deps() {
		return {};
	}
	constructor(kit){}
	Diff(first, second){
		const f= 'Util:Diff:';
		if (_.isEmpty(first)) { return [first,second]; }
		const before= {}; const after= {};
		for (let nm in first) {
			const val = first[nm];
			if (first[nm] !== second[nm]) {
				if (typeof val === 'object') {
					if (_.isEqual(first[nm], second[nm])) { continue; }
				}
				before[nm]= first[nm];
				after[nm]= second[nm];
			}
		}
		return [before, after];
	}
}

exports.Util= Util;
