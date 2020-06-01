// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
//	Poll Manager
//
const _= require('lodash');
const {CircularBuffer}= require('./circular_buffer');

let _log= false;
const _log2= {debug() {}};

class PollManager {
	static initClass() {
		this.deps= {services: ['logger', 'push'], config: 'push_service.max_buffer_size'};
	}
	constructor(kit){
		this.C_PushChangesReceived = this.C_PushChangesReceived.bind(this);
		this.C_ChangesAddedToBuffer = this.C_ChangesAddedToBuffer.bind(this);
		this.C_ChangesRemovedFromBuffer = this.C_ChangesRemovedFromBuffer.bind(this);
		_log= 		kit.services.logger.log;
		// DEBUG _log2= 		kit.services.logger.log
		this.config= 	kit.services.config.push_service;
		this.push= 		kit.services.push;
		this.buffer= 	new CircularBuffer(this.C_ChangesAddedToBuffer, this.C_ChangesRemovedFromBuffer, this.config.max_buffer_size);
		this.pollers= {};
		this.registry= {};
		this.pollers_msgs= {};
		this.data_set_idx= {};
	}

	server_init(kit){
		const f= 'PollManager:server_init:';
		return this.push.RegisterForChanges(this.C_PushChangesReceived);
	}

	PollerTimedOut(id){ return this.S_Finish(id); } // Called when a req times out
	PollerClosed(id){ return this.S_CleanupPoller(id); } // Called when a req connection is closed

	// Called by LongPollRoute to add a new long-poll request
	AddPoller(id, req, res, listen, state, timeoutMillis){
		const f= 'PollManager:AddPoller:';
		this.pollers[id]= {req, res, state, listen, handles: [], handle_map: {}};
		this.pollers[id].timeout= setTimeout((() => this.PollerTimedOut(id)), timeoutMillis);

		// Add id to registry for each handle; Map given name to handle
		for (let nm in listen) {
			const handle = listen[nm];
			const [pset,item,count]= Array.from(handle.split('/'));
			const partial_handle= pset+ '/'+ item;
			if (this.registry[partial_handle] == null) {this.registry[partial_handle] = []; }
			this.registry[partial_handle].push(id);
			this.pollers[id].handles.push(partial_handle);
			this.pollers[id].handle_map[partial_handle]= nm;
		}
		_log2.debug(f, 'handle_map:', this.pollers[id].handle_map);
		return this.S_ValidateHandles(id, listen);
	}

	// TODO: Verify Access to Handles
	S_ValidateHandles(id, listen){
		let count;
		const f= 'PollManager:S_ValidateHandles:';
		const missing_changes= [];

		// Gather all changes this poller has missed
		for (let nm in listen) {
			let item, pset;
			const handle = listen[nm];
			[pset,item,count]= Array.from(handle.split('/'));
			const ph= pset+ '/'+ item; // partial handle
			for (let change of Array.from(this.S_GetMissingChanges(ph, count))) { missing_changes.push(change); }
		}
		missing_changes.sort((a, b) => a.count - b.count);

		// Fast Forward the Poller if missing changes
		if (missing_changes.length) {
			return this.S_FastForwardWithChanges(id, this.S_FormatChanges(this.S_SortChanges(missing_changes)));
		}
	}

	// Add changes to index for easy access to circular buffer
	S_IndexChanges(raw_changes, idx_list){
		const f= 'PollManager:S_IndexChanges:';
		return (() => {
			const result = [];
			for (let idx = 0; idx < raw_changes.length; idx++) {
				const change = raw_changes[idx];
				const ph= change.pset_id+ '/'+ change.pset_item_id; // partial handle
				if (this.data_set_idx[ph] == null) {this.data_set_idx[ph] = []; }
				result.push(this.data_set_idx[ph].push(idx_list[idx]));
			}
			return result;
		})();
	}

	// Remove changes from index that are no longer in the circular buffer
	S_UnIndexChanges(raw_changes){
		const f= 'PollManager:S_UnIndexChanges:';
		for (let change of Array.from(raw_changes)) {
			const ph= change.pset_id+ '/'+ change.pset_item_id; // partial handle
			if (!this.data_set_idx[ph]) { return; }
			this.data_set_idx[ph].shift();
		}
	}

	// TODO: Handle case where count is too far behind
	// Grab changes from the index/buffer that are newer than current_count
	S_GetMissingChanges(partial_handle, current_count){
		const f= 'PollManager:S_GetMissingChanges:';
		const changes= [];
		const idx_list= this.data_set_idx[partial_handle];
		if (!(idx_list != null ? idx_list.length : undefined)) { return []; } // TODO: WHAT HAPPENS IF HANDLE DOES NOT EXIST?
		const newest_change= this.buffer.getDataAtIndex(idx_list[idx_list.length- 1]);
		if ((newest_change.verb === 'init') || (newest_change.count === (Number(current_count)))) { return []; }
		for (let idx of Array.from(idx_list)) {
			const change= this.buffer.getDataAtIndex(idx);
			if (change.count > current_count) { changes.push(change); }
		}
		return changes;
	}

	// raw_changes
	//	[ {pset_id, pset_item_id, id, count, verb, prev, after, resource}]
	// Sort raw changes by their partial handles
	S_SortChanges(raw_changes){
		const f= 'PollManager:S_SortChanges:';
		const sorted_changes= {};

		// Sort the Changes by pset_id/pset_item_id
		for (let rec of Array.from(raw_changes)) {
			if (rec.verb === 'init') { continue; }
			const partial_handle= `${rec.pset_id}/${rec.pset_item_id}`;
			if (sorted_changes[partial_handle] == null) {sorted_changes[partial_handle] = []; }
			sorted_changes[partial_handle].push(_.pick(rec, ['id','count','verb','prev','after','resource']));
		}
		return sorted_changes;
	}

	// sorted_changes:
	//	{ '1/6': [ {id,count,verb,prev,after,resource}, ...], '2/15': [], ...}
	// Modify sorted changes in to format Poller is expecting
	S_FormatChanges(sorted_changes){
		const f= 'PollManager:S_FormatChanges:';
		const data= {};
		const formatted_changes= [];

		for (let ph in sorted_changes) { // ph: partial_handle
			const change_list = sorted_changes[ph];
			data[ph]= {sync: {}, partial_handle: ph};
			for (let change of Array.from(change_list)) {
				if (!(data[ph].count > change.count)) { data[ph].count= change.count; }
				if (data[ph].sync[change.resource] == null) {data[ph].sync[change.resource] = []; }
				data[ph].sync[change.resource].push(change);
			}
			formatted_changes.push(data[ph]);
		}
		return formatted_changes;
	}

	// formatted_changes:
	//	[ {partial_handle, count, sync }, ... ]
	// Respond to all Pollers that are waiting on changes
	S_RespondWithChanges(formatted_changes){
		let id;
		const f= 'PollManager:S_RespondWithChanges:';
		const req_needs_response= [];
		for (let change of Array.from(formatted_changes)) {
			_log2.debug(f, `got count:${change.count} handle: ${change.partial_handle}`);
			const h= change.partial_handle;
			for (id of Array.from(this.registry[h] != null ? this.registry[h] : [])) {
				if (!Array.from(req_needs_response).includes(id)) { req_needs_response.push(id); }
				const nm= this.pollers[id].handle_map[h];
				if (this.pollers_msgs[id] == null) {this.pollers_msgs[id] = {}; }
				this.pollers_msgs[id][nm]= change.sync;
				this.pollers[id].listen[nm]= h+'/'+change.count;
			}
			this.registry[h]= [];
		}
		return (() => {
			const result = [];
			for (id of Array.from(req_needs_response)) { 				result.push(this.S_Finish(id));
			}
			return result;
		})();
	}

	// Respond to Poller that came in to the system behind
	S_FastForwardWithChanges(id, formatted_changes){
		const f= 'PollManager:S_FastForwardWithChanges:';
		for (let change of Array.from(formatted_changes)) {
			_log2.debug(f, `got count:${change.count} handle: ${change.partial_handle}`);
			const h= change.partial_handle;
			const nm= this.pollers[id].handle_map[h];
			if (this.pollers_msgs[id] == null) {this.pollers_msgs[id] = {}; }
			this.pollers_msgs[id][nm]= change.sync;
			this.pollers[id].listen[nm]= h+'/'+change.count;
		}
		return this.S_Finish(id);
	}

	// Completes a long-poll request for a single Poller
	S_Finish(id){
		const f= 'PollManager:S_Finish:';
		_log2.debug(f, id);
		if (!(id in this.pollers)) { return; } // Request is gone
		const {req,res,state,listen,timeout}= this.pollers[id];
		clearTimeout(timeout);
		req.connection.resume();
		const new_state= state;
		if (id in this.pollers_msgs) {
			_log2.debug(f, 'res end w/msgs', new_state, this.pollers_msgs[id]);
			res.send({state: new_state, listen, sync: this.pollers_msgs[id]});
		} else {
			_log2.debug(f, 'res end w/o msgs', new_state);
			res.send({state: new_state, listen, sync: {}}); // No msgs timeout (end 'long' poll)
		}
		return this.S_CleanupPoller(id);
	}

	// Cleanup all info related to a Poller id
	S_CleanupPoller(id){
		const f= 'PollManager:S_CleanupPoller:';
		_log2.debug(f, id);
		if (!(id in this.pollers)) { return; }
		for (let handle of Array.from(this.pollers[id].handles)) {
			if (this.registry[handle]) {
				_log2.debug(f, `remove id:${id} from registry:${handle}`, this.registry[handle]);
				const ix= (this.registry[handle].indexOf(id));
				if (ix > -1) { this.registry[handle].splice(ix, 1); }
				if (this.registry[handle].length === 0) { delete this.registry[handle]; }
			}
		}
		delete this.pollers[id];
		return delete this.pollers_msgs[id];
	}

	// Called when changes received from Push Polling System
	C_PushChangesReceived(raw_changes){
		const f= 'PollManager:C_PushChangesReceived:';
		_log.debug(f, raw_changes.length);
		for (let rec of Array.from(raw_changes)) { // Parse each change
			rec.after= JSON.parse(rec.after);
			rec.prev= JSON.parse(rec.prev);
		}
		return this.buffer.push(raw_changes, function(err){
			if (err) { return _log.error(f, err, err.stack); }
		});
	}

	// Called when changes are added to the buffer
	C_ChangesAddedToBuffer(raw_changes, idx_list, cb){
		const f= 'PollManager:C_ChangesAddedToBuffer:';
		this.S_IndexChanges(raw_changes, idx_list);
		this.S_RespondWithChanges(this.S_FormatChanges(this.S_SortChanges(raw_changes)));
		return cb(null);
	}

	// Called when changes are removed from the buffer
	C_ChangesRemovedFromBuffer(raw_changes){
		const f= 'PollManager:C_ChangesRemovedFromBuffer:';
		return this.S_UnIndexChanges(raw_changes);
	}
}
PollManager.initClass();

exports.PollManager= PollManager;

