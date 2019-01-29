/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// Listens to the 'after' event on the restify server to track request statistics.
// @param server
// @constructor

let _log= false;

const getOrMakeChildObject= function(){
    let o= arguments[0];

    for (let i = 0; i < arguments.length; i++) {
        const a = arguments[i];
        let c= o[arguments[i]];
        if (!c) {
            c= (o[arguments[i]]= {});
        }
        o= c;
    }
    return o;
};

class Stats {
	constructor(server, log) {
		log.info('Initializing Server Stats...');
		_log= log;
		this._reqs= {};
		server.on('after', function(req, res, route, error) {
            let status= res.statusCode;
            req.log.debug('server.after: returning [',status,'] for req:', route ? route.spec.path : req.url);
            if (!route) {
                return req.log.debug('Stats-Unknown: [',status,'] ', req.url);
            }

            if (typeof status === 'undefined') { status= 0; }
            const n= getOrMakeChildObject(self._reqs, route ? route.spec.method+' '+route.spec.path : 'unknown');
            if (isNaN(n[status])) {
                return n[status]= 1;
            } else {
                return n[status]++;
            }
		});
}

	getStats(){
        return {
            name: 'restify',
            reqs: this._reqs
        };
    }
}

exports.Stats= Stats;