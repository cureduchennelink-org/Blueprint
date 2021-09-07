// Cache : Class to cache your resources while updating them via Push logic

//var window = {};
//var reactive = $ => ({ value: $ })
import { reactive } from "vue"

const now = Date.now()
const log = (...args) => console.log(Date.now() - now, ...args)


// Vue.js reactive REST resource using GET and poller
// Assumptions: Poller endpoint is auth_required; 'Stop' is for all callers
// Interface:
//  new Cache( pollClass, pollUrl, getToken)
//  GetEndpoint( uniqueKey, url): Promise (hashes of reactive object of id-hash of records)
//  LogoutEvent(): void - Inform that token for OAuth is no longer available; remove all state for security


class Cache {
    constructor(pollClass, pollUrl, getToken) {
        this.datasets = {}
        this.getAuthorizationCb = () => 'Bearer ' + getToken().token
        this.poller = new pollClass(pollUrl, this.getAuthorizationCb, this.cHandlePoll.bind(this)) // url, getAuthorizationCb, updatesCb
    }

    LogoutEvent() {
        const f = 'Cache.LogoutEvent:'
        log(f)
        this.poller.Stop() // Stop long poll and destroy state
        this.datasets = {} // Forget all endpoints (for security)
    }

    // Create (or return) an endpoint object and begin GET (to fulfil promise) then Poll (to update reactive objects)
    // returns promise of hash of reactive object of hash of objects (i.e. Promise.resolve( { RoomEvents: reactive( { 0: {message:'a'}, 1: {message: 'b'}})}))
    GetEndpoint(uniqueKey, url) { // i.e. GetResource( 'chat', '/RoomEvents')
        const f = 'Cache.GetEndpoint:'
        log(f, { uniqueKey, url })
        if (this.datasets[uniqueKey]) return this.datasets[uniqueKey].promise // Someone already set this up

        const dataset = { uniqueKey, url, result: {}, pushHandle: false }
        this.datasets[uniqueKey] = dataset
        dataset.promise = window.fetch(url, {
            headers: { Authorization: this.getAuthorizationCb() },
        })
            .then((result) => this.sHandleFetch(dataset, result))
        return dataset.promise
    }

    async sHandleFetch(dataset, response) {
        const f = 'Cache.sHandleFetch:'
        const apiData = await response.json()
        log(f, { uniqueKey: dataset.uniqueKey, apiData })
        dataset.pushHandle = apiData.push_handle
        // {success: true, req_uuid: '', ANY_HASH: [{id: 0, other-fields}, ...]} -> dataset.result= { ANY_HASH: reactive {0: {}, ...}}
        for (let hash of Object.keys(apiData)) {
            log('apiData-hash', { hash, row: apiData[hash] })
            if (['success', 'req_uuid', 'push_handle'].includes(hash)) continue
            // Convert dbRows with id to object w/id as keys
            const inner = {}
            for (let row of apiData[hash]) {
                inner[row.id] = row // TODO Object.assign( {}, row)
            }
            dataset.result[hash] = reactive(inner)
        }
        //dataset.pushHandle.c= 8 // TODO TESTING
        this.poller.AddHandle(dataset.uniqueKey, dataset.pushHandle)
        return dataset.result // The resolution of dataset.promise
    }


    // Private methods s* (static), c* (callbacks

    // Handles the response from a Long Poll request (All/any endpoints are potentially inside this one response)
    cHandlePoll(data, err) {
        const f = 'Cache.cHandlePoll:'
        log(f, { data, err })
        if (err) {
            console.log.error(err)
            return false // Tell poller to stop TODO IS THIS ALWAYS THE WAY TO GO??
        }
        // data.sync is {UNIQUE_KEY: [ verb:'create', resource: ANY_HASH, id: ID, new_record: OBJECT]}, UNIQUE_KEY: [], ...
        for (let key of Object.keys(data.sync)) {
            let dataset = this.datasets[key]
            this.sHandleDeltaList(dataset, data.sync[key]) // An array of verbs against this uniqueKey each for ANY_HASH
        }
        return true // Tell poller to start again with updated handles
    }

    sHandleDeltaList(dataset, deltaList) {
        for (let row of deltaList) {
            // Assume 'create' is the only verb for now
            dataset.result[row.resource][row.id] = row.new_record // TODO Object.assign( {}, row.new_record); // Add a hash value (copied object) to our reactive object
        }
    }
}
export { Cache }

    //let getToken= $=> {token: 'some-token'}
    //let cache= new Cache(LongPoll, 'http://localhost:9101/api/v1/Poll', getToken);
    //let promise= cache.GetEndpoint( 'chat', 'http://localhost:9101/api/v1/RoomEvents');
    //promise.then( $=> console.log( 'promise.then', $))
