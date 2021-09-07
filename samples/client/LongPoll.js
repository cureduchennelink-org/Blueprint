// A cheap REST Long-poll method for Blueprint push updates

var window = {};
const now = Date.now();
const log = (...args) => console.log('LongPoll', Date.now() - now, ...args);

class LongPoll {
    // Params:
    //   url: 'https://HOST:PORT/api/vi/Poll';
    //   getAuthorizationCb: => if  token return `${token.tokenType} ${token.accessToken}` else return false (not logged in);
    //   updatesCb: (data, err)=> (data is {state,listen,sync}) (err fetch response (currently only when response.status is 401, or an error object))
    constructor(url, getAuthorizationCb, updatesCb) {
        this.url = url;
        this.getAuthorizationCb = getAuthorizationCb; // False if auth not required; else returns false if logged out (stops poller); else returns current access token
        this.updatesCb = updatesCb;

        // Back off and retry network requests
        this.retry = 100;
        this.retryMax = 5000;

        // State of network request logic
        this.xhr = false; // A longpoll request is going?
        this.pending = false; // A setTimeout is going?
        this.abort = false; // True to suspend all activity

        // State of request payload
        this.state = {};
        this.listen = {};
    }

    // Add one handle at at time, or remove a handle (using false for pushHandle)
    AddHandle(name, pushHandle) {
        log('AddHandle', {name,pushHandle,isXhr: this.xhr!== false,isAbort: this.abort=== true})
        if (pushHandle === false) {
            delete this.listen[name];
        } else {
            this.listen[name] = pushHandle; // Add
        }
        // Long polls have to be aborted and restarted to update the server's handle list
        if (this.xhr !== false) { this.controller.abort(); this.xhr = false; }
        this.abort = false;
        return this.start();
    }

    // Stop polling (preserveState is optional)
    Stop(preserveState= false) {
        log('Stop');
        this.abort = true; // Before controller.abort() to signal to not try again
        if (this.pending !== false) { clearTimeout(this.pending); this.pending = false; }
        if (this.xhr !== false) { this.controller.abort(); this.xhr = false; }
        this.state = {};
        if (preserveState !== true) { this.listen = {}; }
    }

    ajax(options) {
        log('ajax');
        const jsonHeaders= {
            'Content-Type': 'application/json; charset=utf-8',
            Accept: 'application/json, text/*',
        }
        this.controller = new window.AbortController();
        const xhr = window.fetch(options.url, {
            method: 'POST',
            signal: this.controller.signal,
            headers: Object.assign( {}, jsonHeaders, options.headers || {}),
            body: JSON.stringify(options.data),
        });
        let good = false;
        xhr.then(response => {
            log('ajax:response', { response, abort: this.abort });
            if (this.abort) { return; }
            if (response.ok) {
                good = true;
                return response.json();
            } else {
                return response;
            }
        }).then(response => {
            if (good === true) {
                return options.onsuccess(response);
            } else {
                return options.onerror(response);
            }
        }).catch(e => {
            log('ajax:catch', e);
            options.onerror(e);
        });
        return xhr;
    }

    start(delay) {
        log('start',{delay,pending:this.pending});
        if (delay === true) { this.abort = false; delay = this.retry; } // Special case, un-suspend activity
        if ((this.pending !== false) || (this.xhr !== false) || (this.abort === true)) { return; }
        if (delay == null) { delay = this.retry; }
        if (delay > this.retryMax) { delay = this.retryMax; }
        const options = {
            url: this.url,
            headers: {}, // Possibly updated in setTimeout
            onsuccess: async data => {
                log('start.onsuccess', { abort: this.abort });
                this.xhr = false;
                if (this.abort === true) { return; }
                const again = await this.updatesCb(data);
                if (data.state != null) { this.state = data.state; }
                if (data.listen != null) { this.listen = data.listen; }
                if (again) { this.start(); }
            },
            // Note: does not message when response is an error object, or when a non response.ok from fetch isn't .status=== 401
            onerror: response => {
                log('start.onerror', { abort: this.abort });
                this.xhr = false;
                if (this.abort === true) { return; }
                if (response.status === 401) { this.updatesCb(null, response); }
                this.start(delay * 2); // Back off exponentially
            }
        };
        this.pending = setTimeout(() => {
            log('start.pending',{abort:this.abort,listen:this.listen})
            if (this.abort === true) { return; }
            options.data = { state: this.state, listen: this.listen, };
            this.pending = false;
            // Get the very latest token available, if no function proceed without a header
            if (this.getAuthorizationCb !== false) {
                const authorizationHeader = this.getAuthorizationCb();
                if (authorizationHeader === false) { return; } // Logged out
                options.headers.Authorization = authorizationHeader;
            }
            this.xhr = this.ajax(options);
        }, delay);
    }
}

if (process.env.TEST === 'client') {
    // Mock some browser logic
    class AbortController {
        constructor() {
            this.signal = this.signal.bind(this);
            this.abort = this.abort.bind(this);
        }
        signal(cb) {
            this.cb = cb;
        };
        abort() {
            this.cb();
        };
    };
    window = {
        AbortController,
        fetch: (url, options) => {
            log('fetch')// , {url, options});
            //const result={ ok: false, status: 401};
            //const result={ ok: false, status: 500};
            //const result={ ok: true, status: 500, json: ()=> 'five'};
            const result = { ok: true, status: 200, json: () => 'stuff' };
            let myGood, myBad;
            let promise = new Promise((good, bad) => {
                setTimeout(() => good(result), 3000);
                myBad = bad;
                myGood = good;
            });
            options.signal(() => {
                log('fetch', 'abort');
                myBad({ ok: true });
            });
            return promise;
        },
    };
    const updatesCb = (data, err) => {
        log('updatesCb', { data, err });
        if (err) return; // Not waited on, and return value not used
        //Promise.resolve( err? err: data);
        return new Promise((good, bad) => {
            poll.AddHandle('dude', {c:35, h: '/RoomEvent,101'});
            setTimeout(() => {
                good(false);
            }, 1500);
        });
    };
    let authorizationHeader = `token-type token-value`; //false;
    const poll = new LongPoll('http://localhost:9101/api/v1/Poll', (() => authorizationHeader), updatesCb);
    poll.AddHandle('dude', {c:1, h: '/RoomEvent,101'});
    setTimeout(poll.Stop.bind(poll), 8000);

}
