//
// CORS for Restify
//
// package.json: (dependencies) "restify-cors-middleware": "^1.1.1",
// src/app.js: const services= [ 'CORS', ]
// src/base: (services:) CORS: { class: 'CORS', file: './lib/cors' }
// src/base: (restify: CORS:) with e.g.:
//		origins: [
//			'http://localhost:8080',
//			'http://some_web_app.deviq.io'
//		]
//		allowHeaders: ['authorization', 'content-type', ]
//		exposeHeaders: [ ]
//
// The minium headers are needed for a response
//  curl -X OPTIONS http://localhost:$PORT/api/v1 -H Origin:\ http://localhost:8080 -v -H Access-Control-Request-Method:\ POST
//
// https://www.npmjs.com/package/restify-cors-middleware
//
const corsMiddleware = require('restify-cors-middleware')

class CORS {
  static deps() { return { services: ['config', 'server', ] }}

  constructor( kit) {
	kit.services.logger.log.debug( 'CORS:constructor', kit.services.config.restify.CORS);
    this.cors = corsMiddleware( kit.services.config.restify.CORS)
  }

  server_init( kit) {
    const { server } = kit.services.server
    server.pre( this.cors.preflight)
    return server.use( this.cors.actual)
  }
}

exports.CORS= CORS;
