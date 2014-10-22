(function() {
	var env= "local";
	var opts= {}
	switch (env) {
		case "local":
			opts= {
				rest: {
		    		  host: 'localhost'
		    		, port: '9500'
		    		, prefix: 'api'
					, version: 'v1'
				},
				poll: {
					auth_req: false
				}
			};
			break;
		case "epic":
			opts= {
				rest: {
		    		  host: 'epic.dv-mobile.com'
		    		, port: '9502'
		    		, prefix: 'api'
					, version: 'v1'
				},
				poll: {
					auth_req: false
				}
			};
			break;
		case "gates":
			opts= {
				rest: {
		    		  host: 'gates.dv-mobile.com'
		    		, port: '8000'
		    		, prefix: 'api'
					, version: 'v1'
				},
				poll: {
					auth_req: false
				}
			};
			break;
	}
	E.Extra.options= opts
})();
