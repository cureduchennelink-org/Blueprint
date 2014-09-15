# Listens to the 'after' event on the restify server to track request statistics.
# @param server
# @constructor

_log= false

getOrMakeChildObject= ()->
    o= arguments[0]

    for a, i in arguments
        c= o[arguments[i]]
        if not c
            c= o[arguments[i]]= {}
        o= c
    o

class Stats
	constructor: (server, log) ->
		log.info 'Initializing Server Stats...'
		_log= log
		@_reqs= {}
		server.on 'after', (req, res, route, error) ->
            status= res.statusCode;
            req.log.debug 'server.after: returning [',status,'] for req:', if route then route.spec.path else req.url
            if not route
                return req.log.debug 'Stats-Unknown: [',status,'] ', req.url

            status= 0 if typeof status is 'undefined'
            n= getOrMakeChildObject self._reqs, if route then route.spec.method+' '+route.spec.path else 'unknown'
            if isNaN n[status]
                n[status]= 1
            else
                n[status]++

	getStats: ()->
        name: 'restify'
        reqs: @_reqs

exports.Stats= Stats