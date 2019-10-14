// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS104: Avoid inline assignments
 * DS202: Simplify dynamic range loops
 * DS203: Remove `|| {}` from converted for-own loops
 * DS204: Change includes calls to have a more natural evaluation order
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';
// Copyright 2007-2012 by James Shelby, shelby (at:) dtsol.com; All rights reserved.

let $, window;
if (window === undefined) {
	$= {extend(bool,obj,source){ return (require('lodash')).extend(obj, source); }};
	window= null;
}

class TagExe {
	constructor(Epic,view_nm) {
		this.Epic = Epic;
		this.view_nm = view_nm;
		this.viewExe= this.Epic.getView();
		this.resetForNextRequest();
	}
	resetForNextRequest(state) {
		this.forms_included= {};
		this.fist_objects= {};
		this.info_foreach= {}; // [table-name|subtable-name]['table'&'row'&'size'&'count']=value
		this.info_if_nms= {}; // [if-name]=boolean (from <if_xxx name="if-name" ..>
		this.info_varGet3= {}; // for &obj/table/var; type variables
		this.info_parts= []; // Push p:attrs with each part, then pop; getTable uses last pushed
		if (state) {
			return this.info_foreach= $.extend(true, {}, state);
		}
	}
	formatFromSpec(val, spec, custom_spec) {
		const f= 'TagExe.formatFromSpec';
		switch (spec) {
			case '':
				this.Epic.log2(f, 'typeof', typeof window.EpicMvc.custom_filter);
				var new_stuff= typeof window.EpicMvc.custom_filter === 'function' ? window.EpicMvc.custom_filter(val, custom_spec) : undefined;
				this.Epic.log2(f, 'custom_filter result', new_stuff);
				return new_stuff;
			case 'count': return (val != null ? val.length : undefined);
			case 'bytes': return window.bytesToSize(Number(val));
			case 'uriencode': return encodeURIComponent(val);
			case 'esc': return window.EpicMvc.escape_html(val);
			case 'quo': return ((val.replace(/\\/g, '\\\\')).replace(/'/g, '\\\'')).replace(/"/g, '\\"');  // Allows an item to be put into single quotes
			case '1': return (String(val))[0];
			case 'lc': return (String(val)).toLowerCase();
			case 'ucFirst':
				var str= (String(str)).toLowerCase();
				return str.slice( 0, 1).toUpperCase()+ str.slice(1);
			default:
				if (((spec != null ? spec.length : undefined)> 4) && (spec[0] === '?')) { // Ex. &Model/Tbl/val#?.true?false;
					const [left,right]= Array.from(spec.substr(2).split('?'));
					return (((val === true) || ((typeof val=== 'number') && val)) || (val != null ? val.length : undefined) ? left : right)
						.replace((new RegExp('['+ spec[1]+ ']', 'g')), ' ');
				} else if ((spec != null ? spec.length : undefined)) {
					// Default spec
					// if val is set, xlate spec to a string w/replaced spaces using first char
					// Ex. &Model/Table/flag#.Replace.with.this.string; (Don't use / or ; or # in the string though)
					if (((val === true) || ((typeof val=== 'number') && val)) || (val != null ? val.length : undefined)) {
						return spec.substr(1).replace((new RegExp('['+ spec.substr(0,1)+ ']', 'g')), ' ');
					} else { return ''; }
				} else { return val; }
		}
	}
	varGet3(view_nm, tbl_nm, key, format_spec, custom_spec) {
		this.viewExe.haveTableRefrence(view_nm, tbl_nm);
		if (this.info_varGet3[view_nm] == null) {this.info_varGet3[view_nm] = this.Epic.getInstance(view_nm); }
		const row= (this.info_varGet3[view_nm].getTable(tbl_nm))[0];
		return this.formatFromSpec(row[key], format_spec, custom_spec);
	}
	varGet2(table_ref, col_nm, format_spec, custom_spec, sub_nm) {
		let ans= this.info_foreach[table_ref].row[col_nm];
		if (sub_nm != null) { ans= ans[sub_nm]; }
		return this.formatFromSpec(ans, format_spec, custom_spec);
	}

	loadFistDef(flist_nm) { return this.fist_objects[flist_nm] != null ? this.fist_objects[flist_nm]: (this.fist_objects[flist_nm] = this.Epic.getFistInstance(flist_nm)); }
	checkForDynamic(oPt) { // dynamic="div" delay="2"
		const tag= 'dynamic' in oPt.attrs ? this.viewExe.handleIt(oPt.attrs.dynamic) : '';
		if (tag.length === 0) { return ['', '', false]; }
		let delay= 1;
		let id= 'epic-dynopart-'+ this.Epic.nextCounter();
		const plain_attrs= [];
		for (let attr in oPt.attrs) {
			const val = oPt.attrs[attr];
			switch (attr) {
				case 'part': case 'dynamic': continue; break;
				case 'delay': delay= this.viewExe.handleIt(val); break;
				case 'id': id= this.viewExe.handleIt(val); break;
				default: plain_attrs.push(`${attr}=\"${this.viewExe.handleIt(val)}\"`);
			}
		}
		const state= $.extend(true, {}, this.info_foreach); // TODO SNAPSHOT MORE STUFF?
		return [ `<${tag} id=\"${id}\" ${plain_attrs.join(' ')}>`, `</${tag}>`,
			{id, delay: delay* 1000, state}];
	}
	loadPartAttrs(oPt) {
		const f= ':tag.loadPartAttrs';
		const result= {};
		for (let attr in oPt.attrs) {
			const val = oPt.attrs[attr];
			const [p,a]= Array.from(attr.split(':'));
			if (p !== 'p') { continue; }
			result[a]= this.viewExe.handleIt(val);
		}
			//@Epic.log2 f, a, result[a]
		return result;
	}
	Tag_page_part(oPt) {
		const f= ':tag.page-part:'+ oPt.attrs.part;
		this.info_parts.push(this.loadPartAttrs(oPt));
		const [before, after, dynamicInfo]= Array.from(this.checkForDynamic(oPt));
		//@Epic.log2 f, dynamicInfo
		const out= before+ (this.viewExe.includePart((this.viewExe.handleIt(oPt.attrs.part)), dynamicInfo))+ after;
		this.info_parts.pop();
		return out;
	}
	Tag_page(oPt) { return this.viewExe.includePage(); }
	getTable(nm) {
		const f= ':TagExe.getTable:'+ nm;
		//@Epic.log2 f, @info_parts if nm is 'Part'
		switch (nm) {
			case 'Control': case 'Form': return this.fist_table[nm];
			case 'If': return [this.info_if_nms];
			case 'Part': return this.info_parts.slice(-1);
			case 'Field':
				var row= {};
				for (let field of Array.from(this.fist_table.Control)) {
					row[field.name]= [field];
				}
				return [row];
			default: return [];
		}
	}
	Tag_form_part(oPt) { // part="" form="" (opt)field=""
		const part= this.viewExe.handleIt(oPt.attrs.part != null ? oPt.attrs.part : 'fist_default');
		const row= this.viewExe.handleIt(oPt.attrs.row != null ? oPt.attrs.row : false);
		const fm_nm= this.viewExe.handleIt(oPt.attrs.form);
		const oFi= this.loadFistDef(fm_nm); // Set state for viewExe.doAllParts/doTag calls
		// Optional fields
		const one_field_nm= (oPt.attrs.field != null) ? this.viewExe.handleIt(oPt.attrs.field) : false;
		const help= this.viewExe.handleIt(oPt.attrs.help != null ? oPt.attrs.help : '');
		const show_req= 'show_req' in oPt.attrs ? this.viewExe.handleIt(oPt.attrs.show_req) : 'yes';
		let any_req= false;
		let is_first= true;
		const out= [];
		const hpfl= oFi.getHtmlPostedFieldsList(fm_nm);
		const issues= oFi.getFieldIssues();
		const map= window.EpicMvc['issues$'+ this.Epic.appConf().getGroupNm()];
		for (let fl_nm of Array.from(hpfl)) {
			var left;
			if ((one_field_nm !== false) && (one_field_nm !== fl_nm)) { continue; }
			const orig= oFi.getFieldAttributes(fl_nm);
			const fl= $.extend({}, orig);
			fl.is_first= is_first === true ? 'yes' : '';
			is_first= false;
			fl.yes_val = fl.type === 'yesno' ? String((fl.cdata != null ? fl.cdata : '1')) : 'not_used';
			fl.req= fl.req === true ? 'yes' : '';
			if (fl.req === true) { any_req= true; }
			fl.name= fl_nm;
			if (fl.default == null) {fl.default = ''; } fl.default= String(fl.default);
			const value_fl_nm= row ? fl_nm + '__' + row : fl_nm;
			fl.value= ((left = oFi.getHtmlFieldValue(value_fl_nm))) != null ? left : fl.default;
			fl.selected= (fl.type === 'yesno') && (fl.value === fl.yes_val) ? 'yes' : '';
			fl.id= 'U'+ this.Epic.nextCounter();
			fl.type= (fl.type.split(':'))[0];
			if (fl.width == null) {fl.width = ''; }
			//fl.one= if fl.type is 'radio' then oPt.attrs.value else false
			if ((fl.type === 'radio') || (fl.type === 'pulldown')) {
				const choices= oFi.getChoices(fl_nm);
				const rows= [];
				for (let ix = 0, end = choices.options.length, asc = 0 <= end; asc ? ix < end : ix > end; asc ? ix++ : ix--) {
					const s= choices.values[ix] === (String(fl.value)) ? 'yes' : '';
					rows.push({option: choices.options[ix], value: choices.values[ix], selected: s});
				}
				fl.Choice= rows;
			}
			fl.issue= issues[value_fl_nm] ? issues[value_fl_nm].asTable( map)[0].issue : '';
			out.push(fl);
		}
		this.fist_table= {Form: [{show_req, any_req, help}], Control: out};
		return this.viewExe.includePart(part, false); // TODO DYNAMICINFO?
	}

	Tag_defer(oPt) { //TODO OUTPUT CODE INTO SCRIPT TAG WITH FUNCTION WRAPPER TO CALL, FOR BETTER DEBUG
		let name= 'anonymous';
		if ('name' in oPt.attrs) { name= this.viewExe.handleIt(oPt.attrs.name); }
		const code= this.viewExe.doAllParts(oPt.parts);
		this.viewExe.pushDefer({name, code});
		return ''; // This tag has no visible output
	}

	// <epic:if ... family of tags
	Tag_if_any(oPt) { return this.ifAnyAll(oPt, true); }
	Tag_if_all(oPt) { return this.ifAnyAll(oPt, false); }
	Tag_if(oPt) { return this.ifAnyAll(oPt, true); }
	Tag_if_true(oPt) { return this.ifTrueFalse(oPt, true); }
	Tag_if_false(oPt) { return this.ifTrueFalse(oPt, false); }

	ifTrueFalse(oPt, is_if_true) {
		let out;
		const f= ':TagExe.ifTrueFalse';
		const nm= this.viewExe.handleIt(oPt.attrs.name);
		//@Epic.log2 f, oPt.attrs.name, nm, @info_if_nms[nm]
		const found_true= this.info_if_nms[nm] === is_if_true;
		return out= found_true ? this.viewExe.doAllParts(oPt.parts) : '';
	}
	ifAnyAll(oPt, is_if_any) {
		let found_true;
		const f= ':TagExe.ifAnyAll';
		//@Epic.log2 f, oPt.attrs
		let out= '';
		let found_nm= false;
		for (let nm in oPt.attrs) {
			var needle, op, tbl;
			let val = oPt.attrs[nm];
			val= this.viewExe.handleIt(val);
			let flip= false;
			switch (nm) {
				// Alternate method, 'val="&...;" eq="text"'
				case 'right': var right= val; continue; break;
				case 'left': case 'val': case 'value': var left= val; continue; break;
				case 'name': found_nm= val; continue; break;
				case 'eq': case 'ne': case 'lt': case 'gt': case 'ge': case 'le': case 'op':
					if (nm !== 'op') { right= val; op= nm; } else { op= val; }
					var use_op= op;
					if (op.substr(0,1) === '!') { flip= true; use_op= op.substr(1); }
					switch (use_op) {
						case 'eq': found_true= left=== right; break;
						case 'ne': found_true= left!== right; break;
						// These comparisons are always numeric
						case 'gt': found_true= (Number(left))>  (Number(right)); break;
						case 'ge': found_true= (Number(left))>= (Number(right)); break;
						case 'lt': found_true= (Number(left))<  (Number(right)); break;
						case 'le': found_true= (Number(left))<= (Number(right)); break;
					}
					op= null;
					break;
				case 'not_empty': case 'empty':
					if (nm === 'not_empty') { flip= true; }
					found_true= val.length === 0;
					break;
				case 'in_list': case 'not_in_list':
					if (nm === 'not_in_list') { flip= true; }
					found_true= (needle = left, Array.from(( val.split(','))).includes(needle));
					break;
				case 'table_has_no_values': case 'table_is_empty': case 'table_is_not_empty': case 'table_has_values':
					if ((nm === 'table_has_no_values') || (nm === 'table_is_empty')) { flip= true; }
					var [lh, rh]= Array.from(val.split('/')); // Left/right halfs
					// If left exists, it's nested as table/sub-table else assume model/table
					if (lh in this.info_foreach) {
						tbl= this.info_foreach[lh].row[rh];
					} else {
						this.viewExe.haveTableRefrence(lh, rh);
						const oMd= this.Epic.getInstance(lh);
						tbl= oMd.getTable(rh);
					}
					found_true= tbl.length !== 0;
					break;
				case 'if_true': case 'if_false':
					if (nm === 'if_true') { flip= true; }
					found_true= this.info_if_nms[val] === false;
					break;
				case 'true': case 'false':
					if (nm === 'true') { flip= true; }
					found_true= (val === false) || (val === 'false');
					break;
				case 'not_set': case 'set':
					if (nm === 'not_set') { flip= true; }
					found_true= (val === true) || ((typeof val === 'number') && val) ||
						((typeof val === 'string') && (val.length> 0) && !val.match(/^(no|false|n|0)$/i) )
						? true : false;
					break;
			}
			if (flip) { found_true= !found_true; }
			if (is_if_any && found_true) { break; }
			if (!is_if_any && !found_true) { break; }
		}
		if (found_nm !== false) {
			//@Epic.log2 f, found_nm, found_true, oPt.attrs
			this.info_if_nms[found_nm]= found_true;
		}
		if (found_true) { out= this.viewExe.doAllParts(oPt.parts); }
		return out;
	}
	Tag_comment(oPt) { return `\n<!--\n${this.viewExe.doAllParts(oPt.parts)}\n-->\n`; }

	Tag_foreach(oPt) {
		let tbl;
		const f= ':TagExe.Tag_foreach';
		const at_table= this.viewExe.handleIt(oPt.attrs.table);
		const [lh, rh]= Array.from(at_table.split('/')); // Left/right halfs
		// If left exists, it's nested as table/sub-table else assume model/table
		if (lh in this.info_foreach) {
			tbl= this.info_foreach[lh].row[rh];
		} else {
			this.viewExe.haveTableRefrence(lh, rh);
			const oMd= this.Epic.getInstance(lh);
			tbl= oMd.getTable(rh);
		}
		if (tbl.length === 0) { return ''; } // No rows means no output
		let rh_alias= rh; // User may alias the tbl name, for e.g. reusable include-parts
		if ('alias' in oPt.attrs) { rh_alias= this.viewExe.handleIt(oPt.attrs.alias); }
		this.info_foreach[rh_alias]= {};
		const break_rows_list= this.calcBreak(tbl.length, oPt);
		//@Epic.log2 f, 'break_rows_list', break_rows_list
		let out= '';
		let limit= tbl.length;
		if ('limit' in oPt.attrs) { limit= Number( this.viewExe.handleIt(oPt.attrs.limit))- 1; }
		for (let count = 0; count < tbl.length; count++) {
			const row = tbl[count];
			if (count> limit) { break; }
			this.info_foreach[rh_alias].row= $.extend(true, {}, row, {
				_FIRST: (count === 0 ? 'F' : ''), _LAST: (count === (tbl.length- 1) ? 'L' : ''),
				_SIZE:tbl.length, _COUNT:count, _BREAK: (Array.from(break_rows_list).includes(count+ 1) ? 'B' : '')
			}
			);
			out+= this.viewExe.doAllParts(oPt.parts);
		}
		delete this.info_foreach[rh_alias];
		return out;
	}
	calcBreak(sZ,oPt) { // Using oPt, build list of row#s to break on
		let check_row, last_check_row, repeat_value;
		const p= oPt.attrs; // shortcut
		const break_rows_list= [];
		for (let nm of [ 'break_min', 'break_fixed', 'break_at', 'break_even']) {
			p[nm]= (p[nm] != null) ? (Number(this.viewExe.handleIt(p[nm]))) : 0;
		}
		let check_for_breaks= p.break_min && (sZ< p.break_min) ? 0 : 1;
		if (check_for_breaks && p.break_fixed) {
			check_row= p.break_fixed;
			while (sZ> check_row) {
				break_rows_list.push(check_row+ 1);
				check_row+= p.break_fixed;
			}
			check_for_breaks= 0;
		}
		if (check_for_breaks && p.break_at) {
			repeat_value= 0;
			last_check_row= 0;
			for (check_row of Array.from(p.break_at.split(','))) {
				if (!check_row.length) {
					// Special case, repeat until no more rows
					if ((last_check_row<= 0) || (repeat_value<= 0)) { break; }
					check_row= last_check_row+ repeat_value;
					while (sZ> check_row) {
						break_rows_list.push(check_row+ 1);
						check_row+= repeat_value;
					}
					break; // No use checking anymore; foreach should end anyhow
				} else {
					if (check_row<= 0) { break; }
					if (sZ> check_row) {
						break_rows_list.push(check_row+ 1);
					} else { break; }
				}
				// Capture values of rspecial 'repeat' case
				repeat_value= check_row- last_check_row;
				last_check_row= check_row;
			}
			check_for_breaks= 0;
		}
		if (check_for_breaks && p.break_even) {
			let column_count= 1; // Determine this, then split rows evenly
			repeat_value= 0;
			last_check_row= 0;
			for (check_row of Array.from(p.break_even.split(','))) {
				if (!check_row.length) {
					// Special case, repeat until no more rows
					if ((last_check_row<= 0) || (repeat_value<= 0)) { break; }
					check_row= last_check_row+ repeat_value;
					while (sZ>= check_row) {
						column_count++;
						check_row+= repeat_value;
					}
					break; // No use checking anymore; foreach should end anyhow
				} else {
					if (check_row<= 0) { break; } // Count not good
					if (sZ>= check_row) { column_count++; } else { break; }
				}
				// Capture values ofr special 'repeat' case
				repeat_value= check_row- last_check_row;
				last_check_row= check_row;
			}
			// Now spread the rows based on column count (like break_fixed after division
			if (column_count> 1) {
				const break_fixed= Math.floor(sZ/ column_count);
				let extra_rows= sZ- (break_fixed* column_count);
				check_row= break_fixed;
				while (sZ> check_row) {
					if (extra_rows) { check_row++; extra_rows--; }
					break_rows_list.push(check_row+ 1);
					check_row+= break_fixed;
				}
			}
			check_for_breaks= 0;
		}
		return break_rows_list;
	}
	Tag_dyno_form(oPt) { return this.Tag_form_part(oPt); }
	Tag_form(oPt) {
		let saw_method= false;
		const out_attrs= [];
		for (let attr in oPt.attrs) {
			let val = oPt.attrs[attr];
			val= this.viewExe.handleIt(val);
			let add=  false;
			switch (attr) {
				case 'forms_used': this.forms_included= val.split(','); break;
				case 'method': saw_method= true; break;
				case 'show_required': case 'help':
					break;
				default: add= true;
			}
			if (add) { out_attrs.push(`\
${attr}="${val}"\
`
			); }
		}
		if (!saw_method) { out_attrs.push('METHOD="POST"'); }
		for (let fist_nm of Array.from(this.forms_included)) {
			this.loadFistDef(fist_nm);
		} // Loads and caches
		if (!this.forms_included.length) { this.forms_included= ['A FORM TAG WITH NO NAME?']; } //TODO
		let o= `\
<form ${out_attrs.join(' ')}>
\
`;
			//TODO <input type="hidden" name="_c" value="#{window.EpicMvc.escape_html @Epic.getContext()}">
		try {
			o+= this.viewExe.doAllParts(oPt.parts);
		} finally {
			this.forms_included= (this.fist_objects= []);
		}
		return o+= '</form>';
	}
	Tag_control(oPt) {
		const fl_nm= oPt.attrs.field;
		const fm_nm= this.viewExe.handleIt(oPt.attrs.form);
		const oFi= this.loadFistDef(fm_nm); // Set state for viewExe.doAllParts/doTag calls
		const fl_def= oFi.getFieldAttributes(fl_nm);
		const value= oFi.getHtmlFieldValue(fl_nm);
		const one= fl_def.type.substr(0, 5 === 'radio') ? oPt.attrs.value : null;
		const control_html= this.Epic.renderer.doControl(oFi, fl_nm, value, fl_def.type,
			fl_def.cdata, fl_def.width, fl_def.max_length, one);
		return control_html;
	}
	Tag_form_action(oPt) {
		let o;
		const link= {};
		if (oPt.attrs.src != null) {
			if (oPt.attrs.type == null) {oPt.attrs.type = 'image'; }
			if (oPt.attrs.border == null) {oPt.attrs.border = '0'; }
		}
		const out_attrs= [];
		let action= '';
		let value= '';
		for (let attr of Object.keys(oPt.attrs || {})) {
			const val = oPt.attrs[attr];
			switch (attr) {
				case 'action': action= $.trim(this.viewExe.handleIt(val)); break;
				case 'value': value= $.trim(this.viewExe.handleIt(val)); break;
				default:
					if (attr.match(/^p_/)) {
						link[attr.substr(2)]= this.viewExe.handleIt(val);
					} else {
						out_attrs.push(`\
${attr}="${window.EpicMvc.escape_html(this.viewExe.handleIt(val))}"\
`
						);
					}
			}
		}
		link._b= action; // _b instead of _a because we are a 'button'
		const click_index= this.Epic.request().addLink(link);
		return o= this.Epic.renderer.form_action(out_attrs, click_index, action, value);
	}
	Tag_link_action(oPt) {
		let o;
		const link= {};
		const plain_attr= {};
		const action= this.viewExe.handleIt(oPt.attrs.action);
		link._a= action;
		// Add any 'p:*' (inline parameters in HTML) to the HREF
		for (let attr of Object.keys(oPt.attrs || {})) {
			const val = oPt.attrs[attr];
			if ((attr.substr(0, 2)) === 'p:') {
				link[attr.substr(2)]= this.viewExe.handleIt(val);
			} else { switch (attr) {
				case 'href': case 'onclick': case 'action':
					break;
				default: plain_attr[attr]= this.viewExe.handleIt(val);
			} }
		}
		let text= '';
		text+= this.viewExe.doAllParts(oPt.parts);
		const id= '';
		let attr_text= '';
		for (let k of Object.keys(plain_attr || {})) {
			const v = plain_attr[k];
			attr_text+= ` ${k}=\"${window.EpicMvc.escape_html(v)}\"`;
		}
		const click_index= this.Epic.request().addLink(link);
		return o= this.Epic.renderer.link_action(click_index, id, attr_text, text);
	}
}

if (window != null) { window.EpicMvc.Model.TagExe$Base= TagExe;
} else { module.exports= function(w){ w.EpicMvc.Model.TagExe$Base= TagExe; return window= w; }; }

