/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
'use strict';
// Copyright 2007-2012 by James Shelby, shelby (at:) dtsol.com; All rights reserved.


// Parse out varGet2/3's as array with func name set
const FindVars= function(text) {
	const parts= text.split(/&([a-zA-Z0-9_]+\/[^;]{1,60});?/gm);
	let i= 0;
	if (parts.length=== 1) { return text; }
	while (i< (parts.length- 1)) {
		var custom_hash_part, hash_part;
		var args= parts[ i+ 1].split('/');
		const last= args.length- 1;
		[ args[last], hash_part, custom_hash_part]= Array.from(args[last].split('#'));
		parts[ i+ 1]= (() => { switch (args.length) {
			case 2: return [ 'varGet2', [args[0], args[1], hash_part, custom_hash_part] ];
			case 3: return [ 'varGet3', [args[0], args[1], args[2], hash_part, custom_hash_part] ];
			default: throw `VarGet reference did not have just 2 or 3 slashes (${parts[i+ 1]})`;
		} })();
		i+= 2;
	}
	return parts;
};

const ParseFile= function(file_stats, file_contents) {
	const clean= file_contents.replace( /-->/gm, '\x02').replace(/<!--[^\x02]*\x02/gm, '');
	const parts= clean.split(/<(\/?)epic:([a-z_0-9]+)([^>]*)>/);
	let i= 0;
	const tag_wait= []; // Holds back list of indexes while doing a nested tag
	let finish= []; // List of indexes for a tag
	while (i< (parts.length- 1)) {
		parts[ i]= FindVars(parts[ i]);
		if (parts[ i+ 1]=== '/') { // Close tag
			if (!tag_wait.length) {
				throw `[${file_stats}] Close tag found when none expected close=${parts[i+2]}`;
			}
			const oi= tag_wait.pop();
			if (parts[ i+ 2] !== parts[ oi+ 2]) {
				throw `[${file_stats}] Mismatched tags open=${parts[oi+2]}, close=${parts[i+2]}`;
			}
			finish[ 0]= i+ 4; parts[ oi+ 1]= finish;
			finish= tag_wait.pop();
			parts[ i+ 1]= (parts[ i+ 2]= '');
		} else { // Open tag
			finish.push(i+ 1);
			const attr= {}; // No attributes (default)
			let empty= false;
			if (parts[ i+ 3].length> 0) {
				const attr_split= parts[ i+ 3].trim().split(/\s*=\s*"([^"]*)"\s*/);
				empty= attr_split.pop()=== '/';
				parts[ i+ 3]= attr_split;
				for (let a = 0, end = attr_split.length; a < end; a += 2) {
					attr[ attr_split[ a].toLowerCase()]= FindVars(attr_split[ a+ 1]);
				}
			}
			parts[ i+ 3]= attr;

			// Check for 'empty' tag (slash on end of attrs match)
			if (empty=== true) {
				parts[ i+ 1]= [ i+ 4]; // No parts to handle
			} else {
				tag_wait.push(finish); finish= [ -1];
				tag_wait.push(i);
			}
		}
		i+= 4;
	}

	if (tag_wait.length) {
		throw `[${file_stats}] Missing closing epic tags${(Array.from(tag_wait).map((t) => parts[t+2])).join(', ')}`;
	}
	parts[ i]= FindVars(parts[ i]);
	parts.push(finish); // Top level list of parts to render
	return parts;
};

// Public API
if (typeof window !== 'undefined' && window !== null) { window.EpicMvc.ParseFile= ParseFile;
} else { module.exports= w => w.EpicMvc.ParseFile= ParseFile; }

