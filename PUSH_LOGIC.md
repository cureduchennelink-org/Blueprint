# Push Logic Documentation
Blueprint.Node has a strategy to allow client applications the ability to keep a REST resource up-to-date in real time. To support this requires a bit of cooperation with the "shape" of the REST resource response structure, and a database table that tracks changes over time. To address scale concerns, a single endpoint request to the API server will allow all REST resources to be updated by the client (i.e. only one TCP connection from a given client regardless of the number of REST resources that are being tracked.)

## Rough breakdown of the "parts" of the solution
Here is how various parts of the client and server work together to accomplish live updates that are easy to implement on the server side, and easy to consume on the client side.

### REST resource response design
We start with a REST response that is easy to describe changes to both at the server and the client. Basically we use the idea of first normal form (from the relational database world) to "shape" a comprehensive response. Our basic response looks like this:

    {
        success: true,
        req_uuid: 'UUID',
        push_handle: { c: N, h: '/ROUTE,N'},
        SUB_RESOURCE_A: [ { id: N, B_id: N, C_id: N, ...} ...]
        SUB_RESOURCE_B: [ { id: N, D_id: N, ...}, ...]
        SUB_RESOURCE_C: [ { id: N, ...}, ...]
        SUB_RESOURCE_D: [ { id: N, ...}, ...]
    }

As an example, imagine you want to represent participants in a fishing contest, and each participant is on a specific boat. The participant also signed up for specific species of fish. Additionally, the boats will be going to certain "inlets." We could create a list of participants (array) that have inside each participant object a boat object and species object, as well as an inlet object inside the boat objects. Since the same boat object is in several participants, it would be very tricky to describe the changes that need to be made when a boat name changes.

Using the structure above, we could make SUB_RESOURCE_A the participant list without any embedded objects, only attributes along with primary key references to other sub-resources. Then make SUB_RESOURCE_B the boats array, and C the species and D the inlets (associated with boats.) This structure is very much like tables and foreign key references where the joins are done by the client. It is a way to model the REST response that allows easier updates to this resource structure for both the server logic to record changes and the client logic in processing push responses. We will use this example going forward

    {
        success: true,
        req_uuid: 'UUID',
        push_handle: { c: 3521, h: '/Participants,0},
        Participants: [ { id: 509, boat_id: 12, species_id: 8, ...} ...]
        Boats: [ { id: 12, inlet_id: 1, ...}, ...]
        Species: [ { id: 8, ...}, ...]
        Inlets: [ { id: 1, ...}, ...]
    }

### Update endpoint logic
When a resource is updated, an additional DB call must be made to the push logic to record a delta against the REST resource request. Regardless of your DB design, the push logic tracks the REST response "shape". It uses terms and names and organization of data represented by the response you give in the GET /Resource endpoint. For example, if a POST /Boat was made to add a boat, after the endpoint business logic is completed to update the normal DB state, an additional call is made to update the push logic with a specific set of parameters to inform the clients how to update their state. It might look something like this ...

		// Add boat for this inlet to the DB
		new_values={ inlet_id: inlet.id, ident_id: auth_id, name: ctx.p.name}
		dbResult= await this.sdb.boat.Create( ctx, new_values);
		if (dbResult.affectedRows!== 1){ throw new this.E.DbError( f, 'BOAT:CREATE:'+ dbResult.affectedRows)};

		// Notify Push Set of Item Change for a boat
		await this.pushMgr.Create( ctx, this.push_route, 0,{ resource: 'Boats', id: dbResult.insertId, new_record: new_values});

Here we are using several values that will tie back to the one place that the client will need to make a change in the structure that is shown above. The expectation is that a new object is added to the 'Boats" array. To accomplish this, we have used the `this.pushMgr.Create` method to indicate a new record (vs. a delete or an update/modification.) Also, to designate which original GET /Resource call this push record is for, we have earlier defined a unique `this.push_route` value. The `resource` is `Boats` which the client will use to know which SUB_RESOURCE array is being updated. The `id:` is used to target the specific object in a SUB_RESOURCE array. For a `Create` we provide the `new_record` values, whereas for an update it would include both the old and new values, for the client to inspect and utilize. We will talk more on that third parameter (hard coded as `0`) later.

### Return a push_handle on GET requests
When clients make a GET request, they will need a `push_handle` value that can be used to request push updates to this same endpoint. The `push_handle` will also contain a high-water mark that represents where in the list of push-updates the client request occurred. This value is guaranteed to keep clients from missing any updates as long as you use DB transactions on POST, PUT, and DEL endpoints. This concept is different than simple 'events' which only give the client current information while the client is connected. Imagine that while one client is doing a GET another is doing a POST. When the first client gets a response, and opens a connection to get 'events' - that POST event would be missed. One might consider connecting for events before making GET calls - however the POST event would have to be merged with the later GET request - a more complicated client solution. Additionally, how would intermittent or longer term connection loss be handled. If you close your laptop and it goes to sleep for a few mins, then you open it back up - did you miss events during that time? All of these issues are addressed by tracking updates using the push_handle. Near the end of your GET endpoint logic, you would include this line ...

    	send.push_handle= await this.pushMgr.GetPushHandle( ctx, this.push_route, 0);

A common way to acquire the value of `this.push_handle` that is used in both the GET and update endpoints, is to do something like this in your route module constructor ...

	constructor( kit) {
		this.pushMgr= kit.services.PushManager;
		this.push_route= '/MyResourceName';

Now you have a unique push_route prefix, and a reference to the PushManager service having a `GetPushHandle` method for your GET endpoint, and `Create`, `Update`, and `Delete` methods for POST, PUT, and DEL endpoints.

### Client side Poll request
The poller is designed to support multiple GET endpoints multiplexed into a single API server connection for updates. The update logic today is a "long poll" method. This simply means that the server "holds" the connection until an update at the server is ready to be sent to the client. The endpoint also supports a "no_wait" flag, if you wish to do periodic polling from the client instead. Support and examples are in the [samples/client](samples/client) directory. There you will find a LongPoll class that will keep the long polling connection alive and deliver change events to a callback. The client provides the value of a 'push_handle' (from the GET request) and forwards it to the API server poll endpoint. Once a response is given by the API server, updated push_handle values are included. The LongPoll class will capture this and send those updated values for the next request. Also in that `samples/client` directory is a `Cache` class that will manage multiple REST endpoint responses and keep them updated via the `LongPoll` class. It returns a promise that resolves to an object which has a hash for each sub-resource. The sub-resource is indexed by primary ID and is a `reactive` object. Using the GET response example above a call to Cache.GetEndpoint() would return ...


    Promise.resolve({
        Participants: reactive( { 509: { id: 509, boat_id: 12, species_id: 8, ...} ...}),
        Boats:        reactive( { 12: { id: 12, inlet_id: 1, ...}, ...}),
        Species:      reactive( { 8: { id: 8, ...}, ...}),
        Inlets:       reactive( { 1: { id: 1, ...}, ...}),
    })

After this promise is resolved (the GET endpoint response is received) then these `reactive` objects are updated as LongPoll requests come in. The following is an example of setting up the `Cache` class and then requesting a given GET resource to be acquired and continuously updated ...

    // You need a function that will return the latest OAuth information, if the Poll endpoint requires authorization
    let getToken= ()=> ({ token: 'CURRENT-TOKEN'})

    import { LongPoll } from "../LongPoll";
    import { Cache } from "../Cache";

    let cache = new Cache( LongPoll, "https://host/api/v1/Poll", getToken);
    let promise = cache.GetEndpoint( "people", "https://host/api/v1/Participant");

### Client side Poll response handling
When the API poll endpoint returns a response, it wants to update as many push_handles as you have requested. To separate each of these, you send a unique hash for each, and the response matches that unique hash value. For example ...

    POST /Poll state: {}, listen: {people: { c: 3521, h: '/Participants,0'}, profile: { c: 410, h: '/Profile,89'}}

The response for both an update to the Boats under `/Participants,0` and a change to this users profile `/Profile,89` might look like ...

    state: {},
    listen: {
        chat: { c: 4001, h: '/Participants,0'},
        profile: { c: 4003, h: '/Profile,89'}
        },
    sync: {
        people: [{
            resource: "Boats"
            verb: "create"
            id: 13
            new_record: {inlet_id: 101, ident_id: 401, name: "The New Boat",…}
        }],
        profile: [{
            ...
        }]
    }

You will notice a few things - the listen structure has updated push_handle values. The state value is a round-trip opaque value sent by the client, that the API server sends back to the client. It contains whatever your client wishes to send. The `sync` hash has an entry for any updated push_handles. Inside each is an array of updates, having the sub-resource name, the verb for create/update/delete, the primary key on that sub-resource, and the attributes that are changing.

### Unique /filtered endpoint responses
Another thing to consider, from our small example above, is for the `Profile` endpoint, we are not updating this client for the whole set of profiles for all users, but just this one user profile. How can we give each user a unique response (or a response filtered to only their profile record?) To support this we use the primary key on that user record to limit the response to just this row in the table, and we use that 'third' parameter on PushManager methods.

On the GET endpoint, populate the  'third' parameter to `filter` this route by this value (in this case, by the user ident_id from their token) ...

        	send.push_handle= await this.pushMgr.GetPushHandle( ctx, this.push_route, ctx.auth_id);

On updates, provide the same 'third' parameter (assuming the logged in user is changing their own profile)...

		await this.pushMgr.Create( ctx, this.push_route, ctx.auth_id,{ resource: 'Profile', id: dbResult.insertId, new_record: new_values});

## Pushing the envelope on this design
Let's now say that not all Participants in the DB are returned in a GET request. Instead, we want to only give out Participants for the contest we are in. This might be modeled in REST as either GET /Contest (which returns participants), or GET /Participants (where we auto-filter by the contest you are currently involved in.) In either case, we need a push_handle value to represent just this 'slice' of the possible responses for this route. We would use that third parameter to create a unique filter on this endpoint using the contest.id value...

        	send.push_handle= await this.pushMgr.GetPushHandle( ctx, this.push_route, contest.id)

... and on updates we use it again (e.g. when adding a participant to a contest) ...

		await this.pushMgr.Create( ctx, this.push_route, contest.id,{ resource: 'Participant', id: dbResult.insertId, new_record: new_values});

### Boats that are in multiple contests
But we get stuck with Boat updates, since the boat list is not specific to a contest. In this case we have two choices. We can leave Boats as a sub-resource to this endpoint, but then we have to make a call to the PushManager for every contest that has this boat - or we move Boats out of this endpoint and use a separate endpoint for Boats and the related Inlets sub-resource. As a separate resource it then gets a unique push_route value, and all is good. This would change the API, so thought should be given when planning how to combine sub-resources into one endpoint request.