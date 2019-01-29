/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';
// Copyright 2007-2012 by James Shelby, shelby (at:) dtsol.com; All rights reserved.
class ViewExe {
	constructor(Epic,loadStrategy,content_watch) {
		this.Epic = Epic;
		this.loadStrategy = loadStrategy;
		this.content_watch = content_watch;
		this.dynamicParts= [];
		const frames= this.Epic.oAppConf.getFrames();
		this.frames=( (Array.from(((() => {
			const result = [];
			for (let nm in frames) {
				result.push(nm);
			}
			return result;
		})()).sort())).map((ix) => frames[ix]));
		this.Epic.log1(':ViewExec', this.frames);
		// Init things that may be needed in calls made to this class before my 'init' is called
		this.dynamicMap= {}; // Hash by Model:tbl_nm - list of dynamicParts indexes
	}
	init(template, page) {
		this.template = template;
		this.page = page;
		this.Epic.log2(`:ViewExe.init T:${this.template}`, `P:${page}`, (Array.from((this.Epic.getInstance('Pageflow')).getStepPath())).join('/'));
		this.instance= this.Epic.nextCounter(); // Use to ignore delayed requests after a new init occured
		this.oTemplate= this.loadStrategy.template(this.template);
		this.oPage= this.loadStrategy.page(this.page);
		this.pageStack= [];
		for (let nm of Array.from(this.frames)) { this.pageStack.push(this.loadStrategy.template(nm)); }
		this.pageStack.push(this.oTemplate, this.oPage);
		//@Epic.log1 ':ViewExec.init', @pageStack
		this.stack= [];
		this.TagExe= this.Epic.getInstance('Tag');
		this.TagExe.resetForNextRequest();
		this.current= null;
		this.dynamicParts= [{defer:[],parent:0}]; // Parts refrences w/Tag-state allowing a re-draw of this part in the DOM
		this.dynamicMap= {}; // Hash by Model:tbl_nm - list of dynamicParts indexes
		return this.activeDynamicPartIx= 0; // Zero always exists, it's the template
	}
	part(ix) { return this.dynamicParts[ix || this.activeDynamicPartIx]; }
	doDynamicPart(ix, instance) {
		const f= `:ViewExe.doDynamicPart:${ix}`;
		//@Epic.log2 f, 'i,@i,p(i)', instance, @instance, @part ix
		if (instance !== this.instance) { return; }
		const part= this.part(ix);
		if (part.pending === false) { return; } // Must have gotten here already
		part.stamp= new Date().getTime();
		part.pending= false;
		part.defer= []; // Will be rebuild using new content # TODO ALSO TAKE IX OUT OF ALL @dynamicMap LISTS TO BE REBUILT?
		$(`#${part.id}`).html('Changing...');
		const old_dynamic_ix= this.activeDynamicPartIx;
		this.activeDynamicPartIx= ix;
		this.TagExe.resetForNextRequest(part.state);
		$(`#${part.id}`).html(this.run(this.loadStrategy.part(part.name)));
		this.doDeferPart(part);
		for (let watch of Array.from(this.content_watch)) { watch(`#${part.id}`); }
		return this.activeDynamicPartIx= old_dynamic_ix;
	}
	pushDefer(code) {
		return this.part().defer.push(code);
	}
	doDeferPart(part) {
		for (let v of Array.from(part.defer)) { eval(v.code); }
		return true;
	}
	doDefer() {
		for (let part of Array.from(this.dynamicParts)) {
		 		this.doDeferPart(part);
		}
		return true;
	}
	haveTableRefrence(view_nm, tbl_nm) { // Called from TagExe
		if (this.activeDynamicPartIx === 0) { return; }
		const nm= (this.Epic.getInstanceNm(view_nm))+ ':'+ tbl_nm;
		if (this.dynamicMap[nm] == null) {this.dynamicMap[nm] = []; }
		return this.dynamicMap[nm].push(this.activeDynamicPartIx); // Need to detect parents in same list means don't need child
	}
	addDynamicPart(info) {
		const f= ':ViewExe.addDynamicPart';
		//@Epic.log2 f, info, @activeDynamicPartIx, @part()
		if (this.activeDynamicPartIx !== 0) { alert('Nested dynamic parts not really supported just now.'); }
		// Tag calls us with the details; need to start tracking this part specifically
		this.dynamicParts.push({
			name: info.name, id: info.id, delay: info.delay, state: info.state, defer: [],
			parent: this.activeDynamicPartIx, pending: false, stamp: new Date().getTime()
		});
		return this.activeDynamicPartIx= this.dynamicParts.length- 1;
	}
	invalidateTables(view_nm, tbl_nms) {
		let ix;
		const f= ':ViewExe.invalidateTables';
		//@Epic.log2 f, view_nm, tbl_nms, (if @Epic.inClick then 'IN'), @dynamicParts, @dynamicMap
		const sched= [];
		if (this.dynamicParts.length === 1) { return 'no dynamic parts'; } // We have no dynamic parts
		if (this.Epic.inClick) { return 'in click'; }
		const ix_list= {};
		const inst= this.Epic.getInstanceNm(view_nm);
		for (let tbl_nm of Array.from(tbl_nms)) {
			const nm= inst+ ':'+ tbl_nm;
			if (nm in this.dynamicMap) {
				for (ix of Array.from(this.dynamicMap[nm])) { ix_list[ix]= true; }
			}
		}
		// TODO Weed out child parts
		const now= new Date().getTime();
		for (ix in ix_list) {
			ix= Number(ix);
			var part= this.part(ix);
			if (part.pending === false) {
				const sofar= now- part.stamp;
				var delay= sofar> part.delay ? 0 : part.delay- sofar;
				const { instance }= this;
				((ix, instance) => {
					part.pending= window.setTimeout((() => this.doDynamicPart(ix, instance)), delay);
					return sched.push(ix);
				})(ix, instance);
			}
		}
		return sched;
	}
	run(current,dynoInfo) {
		//current?= @oTemplate
		let out;
		if (current == null) {current = this.pageStack.shift(0); }
		this.stack.push([this.current, this.activeDynamicPartIx]);
		this.current= current;
		if (dynoInfo) { this.addDynamicPart(dynoInfo); }
		try {
			out= this.doAllParts(0);
		} catch (e) {
			if (this.stack.length > 0) { throw e; }
			out= e.message+ "<pre>\n"+ e.stack+ "</pre>";
		}
		finally {
			[this.current, this.activeDynamicPartIx]= Array.from(this.stack.pop());
		}
		return out;
	}
	includePage() { return this.run(this.pageStack.shift(0)); } //oPage
	includePart(nm,dynoInfo) {
		if (dynoInfo !== false) { dynoInfo.name= nm; }
		return this.run((this.loadStrategy.part(nm)), dynoInfo);
	}
	doAllParts(parts_inx) {
		let first;
		parts_inx= Number(parts_inx);
		let out= '';
		if (parts_inx === 0) { // Top tag
			out+= this.handleIt(this.current[0]);
			parts_inx= this.current.length- 1;
			first= false; // No first index to ignore
		} else {
			first= true;
			out+= this.handleIt(this.current[ parts_inx+ 3]); // First part after tag is tags first part
		}
		for (let tag_self of Array.from(this.current[parts_inx])) {
			if (first) { first= false; continue; }
			const tag= this.current[ tag_self+ 1];
			const attr= this.current[ tag_self+ 2];
			out+= this.TagExe[`Tag_${tag}`]({parts: tag_self, attrs: attr});
			out+= this.handleIt(this.current[ this.current[ tag_self][0]]);
		} // First index is postfix-text
		return out;
	}
	handleIt(text_n_vars) {
		if (typeof text_n_vars === 'string') { return text_n_vars; }
		let out= text_n_vars[ 0];
		for (let i = 1, end = text_n_vars.length; i < end; i += 2) {
			const [cmd, args]= Array.from(text_n_vars[ i]);
			out+= this.TagExe[cmd].apply(this.TagExe, args);
			out+= text_n_vars[ i+ 1];
		}
		return out;
	}
}

// Public API
if (typeof window !== 'undefined' && window !== null) { window.EpicMvc.ViewExe= ViewExe;
} else { module.exports= w=> w.EpicMvc.ViewExe= ViewExe; }
