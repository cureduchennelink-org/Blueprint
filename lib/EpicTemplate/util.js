/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Some utility functions (as class, not instance functions)
//
const escape_html= str => String(str)
    .replace(/&/g,'&amp;') // '&' must be first
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');


if (typeof window !== 'undefined' && window !== null) { window.EpicMvc.escape_html= escape_html;
} else { module.exports= w => w.EpicMvc.escape_html= escape_html; }
