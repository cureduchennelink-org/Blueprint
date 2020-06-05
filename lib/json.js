
// https://www.bennadel.com/blog/3278-using-json-stringify-replacer-function-to-recursively-serialize-and-sanitize-log-data.htm
var _exposeErrorProperties= function(error, show_stack= false){
	const copy= Object.assign({}, error);
	// In the native Error class (and any class that extends Error), the
	// following properties are not "enumerable". As such, they won't be copied by
	// the Object.assign() call above. In order to make sure that they are included
	// in the serialization process, we have to copy them manually.
	if (error.name) { copy.name= error.name; }
	if (error.message) { copy.message= error.message; }
	if ( show_stack=== true && error.stack) { copy.stack= error.stack; }
	return copy;
}
var _jsonReplacer= function(show_stack){return function( key, value){
	if (value instanceof Error){
		return( _exposeErrorProperties(value,show_stack));
	}
	return( value);
}}

exports._exposeErrorProperties= _exposeErrorProperties;
exports._jsonReplacer= _jsonReplacer; // Use like: JSON.stringify(the_object, _jsonReplacer(true));
