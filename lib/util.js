#
# 	Utility Functions / Object
#

_= require 'lodash'

class Util
	@deps= {}
	constructor: (kit)->
	Diff: (first, second)->
		f= 'Util:Diff:'
		return [first,second] if _.isEmpty first
		before= {}; after= {}
		for nm,val of first when first[nm] isnt second[nm]
			if typeof val is 'object'
				continue if _.isEqual first[nm], second[nm]
			before[nm]= first[nm]
			after[nm]= second[nm]
		[before, after]

exports.Util= Util
