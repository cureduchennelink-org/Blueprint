//
// Axios wrapper to both:
//  Create an axios client or 'agent' (with merged options)
//  and
//   Intercept' request/response to:
//    (a) map errors to our E.ServerError
//    (b) more importanly, log all interaction to ctx.log.debug (using axios' 'interceptors' feature
//
// We mostly use Axios just because it has this interceptor feature
//
// Use:
//   Most users have some static axios options, then a config file overide for options,
//    then options in specific business logic blocks (like some endpoint logic)
//   This module supports creating the axios client/agent with these options, and then adding logging interceptors
//
//  Example:
//   Assume you have a service module called 'Dummy'
//   In your config (like base) you might have 
//      src/base.js (in dummy:): http_options: { baseURL: 'https://graph.facebook.com', timeout: 5000 }
//   The axios_wrqper module is not a 'kit' service, but just a basic include/require:
//      src/Dummy.js (near the top): const axios_wrap= require( './axios_wrap');
//   In your constructor you might say:
//      src/Dummy.js (in constructor): this.make_agent= axios_wrap( { timeout: 500}, this.config.dummy.http_options);
//   In one of your fuctions, to make http calls, you create the client/agent, then use it:
//      src/Dummy.js::_send_message:
//			const agent= this.make_agent( ctx); // Could have added my own options e.g. (ctx, local_options_object)
//			const result= await agent( '/oauth/access_token', {
//				params: {
//					grant_type: 'client_credentials',
//					client_id: this.config.facebook.api_key,
//					client_secret: this.config.facebook.api_secret
//				}
//			});
//			const fbAccessToken= result.data.access_token;
//
const _ = require('lodash');
const E = require('../node_modules/blueprint/lib/error');
const axios = require('axios');

const intercept = (ctx, agent) => {
    var start = false; // Closure

    // Do something before request is sent
    const request_good = (config) => {
        const f = 'interceptors.request.BEFORE';
        ctx.log.debug(f, { // {config}
            timeout: config.timeout,
            headers_common: config.headers.common,
            method: config.method,
            headers_method: config.headers[config.method],
            baseURL: config.baseURL,
            url: config.url,
            params: config.params,
            data: config.data,
        });
        start = Date.now();
        return config;
    }

    // Do something with request error
    const request_bad = (error) => {
        const f = 'interceptors.request.BEFORE-ERROR';
        if (error.config) { // From axios
            ctx.log.debug(f, { JSON_parse: error.toJSON() }); // JCS: Attempt to avoid cyclic error on lamd.write/write_deep
            throw new E.ServerError('AXIOS-1', (error.message || 'NO_MESSAGE'));
        }
        ctx.log.debug(f, { error });
        throw error;
    }

    // Do something with response data
    const response_good = (response) => {
        const f = 'interceptors.response.AFTER';
        ctx.log.debug(f, {// {response} cyclic error
            status: response.status,
            headers_set_cookie: response.headers['set-cookie'],
            request_ClientRequest__header: response.request._header,
            data: response.data,
            time_ms: Date.now() - start,
        });
        // Synapse specific??? throw E.ServerError f, response.data.data.error if response.data?.data?.is_valid is false
        return response;
    }

    // Do something with response error
    const response_bad = (error) => {
        const f = 'interceptors.response.AFTER-ERROR';
        time_ms = Date.now() - start;
        if (error.config) {// From axios
            const response = _.pick((error.response || {}), ['status', 'statusText', 'headers', 'data',]);
            ctx.log.debug(f, { response, JSON_parse: error.toJSON(), time_ms }); // JCS: Attempt to avoid cyclic error on lamd.write/write_deep
            const e = new E.ServerError('AXIOS-3', (error.message || 'NO_MESSAGE'));
            e.response = response;
            throw e;
        }
        ctx.log.debug(f, { error, time_ms });
        throw error;
    }

    agent.interceptors.request.use(request_good, request_bad); // Add a request interceptor
    agent.interceptors.response.use(response_good, response_bad); // Add a response interceptor
}

module.exports = (static_options = {}, config_options = {}) => (ctx, options = {}) => {
    const client = axios.create(_.merge({}, static_options, config_options, options));
    intercept(ctx, client);
    return client;
}