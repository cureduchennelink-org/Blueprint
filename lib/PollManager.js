//
//	Poll Manager
//
// Vocabulary:
//  item: One record from the push_item table (a change record) as {count, route, splice, resource, id, verb, old_rec, new_rec}
//  poller: A pending longpoll request
//  h: abbr for 'handle'
//  r: abbr for 'resource'
//
const dPoller = ({ req_uuid, by_h, listen, }) => ({ req_uuid, by_h: Object.entries(by_h), listen: Object.values(listen) })
const dPollerForH = ({ poller, count, msgs }) => ({ ...dPoller(poller), count, msgs })

class PollManager {
	static deps() {
		return { services: ['logger', 'PushManager'], config: 'push_service.max_buffer_size' };
	}
	constructor(kit) {
		this._log = kit.services.logger.log;
		this._log2 = { debug() { } }; // DEBUG this._log;
		this.config = kit.services.config.push_service;

		// Buffer: Circular buffer used to keep efficient reference, and to delete older items while adding newer items
		this.buffer_pos = 0 // Current position as an index into b.buff array
		this.buffer_len = 0 // Number of items in the array currently stored; should not exceed b.sz
		this.buffer_sz = this.config.max_buffer_size // Size of the array at all times
		this.buffer_buff = new Array(this.buffer_sz) // Contains each 'object' of {count: number, handle: route+slice, {resource, rec_id, verb, old_rec, new_rec}}

		// Items (i.e. push change records)
		this.item_by_h = {} // { route+slice: Set [ object, object, object] } 'object' exists in 'buffer'

		// Pollers (i.e. people who are long polling into us)
		this.poller_by_h = {};
		this.poller_ready = new Set(); // Contains 'poller' objects, which S_CheckOneItem adds to, and S_FinishPoller/S_CleanupPoller will delete
		this.set_timeout = this.config.set_timeout || setTimeout; // Testability
	}

	server_init(kit) {
		const f = 'PollManager:server_init:';
		const pushMgr = kit.services.PushManager;
		pushMgr.RegisterForChanges(this.C_PushItemsReceived.bind(this));
		return true;
	}

	PollerClosed(poller) {
		const f = 'PollManager.PollerClosed:'
		this._log2.debug(f, { ...dPoller(poller) })

		// Called when a req connection is closed
		return this.S_CleanupPoller(poller);
	}

	// Called by LongPollRoute to add a new long-poll request
	AddPoller(req_uuid, state, listen, timeout_ms, callback) {
		const f = 'PollManager:AddPoller:';
		this._log2.debug(f, { req_uuid, state, listen, timeout_ms, callback })

		const poller = { req_uuid, listen, state, callback, by_h: {} };
		poller.timeout = timeout_ms === false ? false : this.set_timeout((() => this.S_FinishPoller(poller)), timeout_ms);

		// Add id to registry for each handle; Map given name to handle
		for (let nm in listen) { // listen: X: {count: 99, h: route+slice}, Boats: {count: 105, h: route+slice}
			const { h, c: count } = listen[nm];
			// Create an object for this handle, to add to the global 'pollers' Set
			const handle_object = { poller, count, msgs: [] };
			if (!(h in this.poller_by_h)) this.poller_by_h[h] = new Set();
			this.poller_by_h[h].add(handle_object);
			poller.by_h[h] = handle_object; // Caution, circular reference, used later to remove from global by_h. (as a reference to remove it from the poller_by_h Set()

		}
		this.S_CheckOnePoller(poller);

		if (this.poller_ready.has(poller)) {
			this.S_FinishPoller(poller);
		} else {
			callback('initial', { listen, state, sync: {} }); // Give caller option to send and close
		}
		return poller; // Expect this back in e.g. PollerClosed() from external caller
	}

	// Does any existing item need to go to this one poller?
	S_CheckOnePoller(poller) {
		const f = 'PollManager:S_CheckOnePoller:';
		this._log2.debug(f, { ...dPoller(poller) })
		const testability = [];

		// For each handle that this poller is interested in
		for (let h in poller.by_h) {
			if (!(h in this.item_by_h)) continue;
			testability.push(this.S_CheckOnePollerForItems(poller.by_h[h], this.item_by_h[h]));
		}
		return testability;
	}

	// One handle specific poller object, and any number of items having this h
	// Look for if this poller needs this item (due to count being later in time)
	S_CheckOnePollerForItems(poller_for_h, items) {
		const f = 'PollManager.S_CheckOnePollerForItems:'
		this._log2.debug(f, { ...dPollerForH(poller_for_h), items_len: items.length })

		const p = poller_for_h;
		let isAdded = false;
		items.forEach(item => {
			if (p.count >= item.id) return
			p.msgs.push(item.payload); // Array of results, by resource, for this handle
			p.count = item.id; // Update the client's count
			// Indicate that a longpoll is ready to finish
			isAdded = true;
		});
		if (isAdded) this.poller_ready.add(p.poller); // Add to the set
		return { isAdded, poller_for_h, items_len: items.length }
	}

	// Completes a long-poll request for a single Poller
	S_FinishPoller(poller) {
		const f = 'PollManager:S_FinishPoller:';
		this._log2.debug(f, { ...dPoller(poller) });

		const { listen, state, callback, timeout } = poller;

		// Create the output msgs for sync
		const poller_msgs = {}; // Hashed by callers nm
		let isMsgs = false;
		for (let nm in listen) {
			const { h } = listen[nm];
			//if(!( h in poller.by_h)) continue;
			const { count, msgs } = poller.by_h[h];
			if (msgs.length === 0) continue;
			listen[nm] = { c: count, h }; // Mutations, Mutations!
			poller_msgs[nm] = msgs;
			isMsgs = true;
		}
		this.S_CleanupPoller(poller); // Call now, to avoid double calls later to to res.send in poller.callback (why does the double call happen?)
		if (isMsgs === true) {
			this._log2.debug(f + 'w', { state, listen, poller_msgs });
			callback('haveRecords', { state: state, listen, sync: poller_msgs });
		} else {
			this._log2.debug(f + 'wo', { state, listen });
			callback('timeout', { state: state, listen, sync: {} }); // No msgs timeout (end 'long' poll)
		}
	}

	// Cleanup all info related to a Poller
	S_CleanupPoller(poller) {
		const f = 'PollManager:S_CleanupPoller:';
		this._log2.debug(f, { ...dPoller(poller) });

		this.poller_ready.delete( poller); // Don't let this poller be called for action after now
		if (poller.timeout !== false) clearTimeout(poller.timeout);
		for (let h in poller.by_h) {
			if (!(h in this.poller_by_h)) continue; // In case someone cleared this out earlier
			this.poller_by_h[h].delete(poller.by_h[h]);
			if (this.poller_by_h[h].size === 0) delete this.poller_by_h[h];
		}
		return poller;
	}

	// Called when changes received from Push Polling System
	C_PushItemsReceived(raw_items) {
		const f = 'PollManager:C_PushItemsReceived:';
		this._log.debug(f, raw_items.length);
		this._log2.debug(f, { raw_items })

		raw_items.forEach(item => {
			// Morph the record to something more consumable
			if (this.buffer_len === this.buffer_sz) this.S_RemoveOneItem();
			this.S_AddOneItem(item);
			this.S_CheckOneItem(item);
		});
		this.poller_ready.forEach(poller => this.S_FinishPoller(poller));
		this.poller_ready = new Set(); // Empty the contents
	}
	// : Take one record out, at the insertion point
	S_RemoveOneItem() {
		const f = 'PollManager:S_RemoveOneItem:';
		this._log2.debug(f, { buffer_pos: this.buffer_pos });

		const item = this.buffer_buff[this.buffer_pos];
		const h = item.route_slice; // Partial handle i.e. route+slice
		this.item_by_h[h].delete(item); // Implemented as a set
		if (this.item_by_h[h].size === 0) delete this.item_by_h[h]; // Optimization to clean up memory
		this.buffer_len--;
		return { item, h, buffer_len: this.buffer_len }; // Testability
	}
	// : Put one record into buffer, and index by handle
	S_AddOneItem(item) {
		const f = 'PollManager:S_AddOneItem:';
		this._log2.debug(f, { item });

		const h = item.route_slice;
		this.buffer_buff[this.buffer_pos] = item;
		this.buffer_len++;
		this.buffer_pos = (this.buffer_pos + 1) % this.buffer_sz;;
		if (!(h in this.item_by_h)) this.item_by_h[h] = new Set();
		this.item_by_h[h].add(item);
		return { h, buffer_len: this.buffer_len, buffer_pos: this.buffer_pos, item_by_h: Array.from(this.item_by_h[h]) }; // Testability
	}
	// Does any existing longpoll need this one item?
	S_CheckOneItem(item) {
		const f = 'PollManager:S_CheckOneItem:';
		this._log2.debug(f, { item });

		const h = item.route_slice; // Partial handle i.e. route+slice
		const pollers = this.poller_by_h[h]; // A Set with a pollers per-handle info
		const testability = { h, check: [] };
		if (pollers) {
			pollers.forEach(p => testability.check.push(this.S_CheckOnePollerForItems(p, [item])));
		}
		return testability;
	}

}

exports.PollManager = PollManager;

