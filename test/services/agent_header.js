// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
//
// TEST: AgentHeader service (and SqlAgentHeader class)
//

const Promise= require('bluebird');
const _= require('lodash');
const server= require('../..');
const uuid= require('uuid');

const chai= 	require('chai');
chai.should();		// Should Expectation Library

const _log= console.log;

describe('AgentHeader:service:', function(){
	const f= 'AgentHeader:service';
	const uid= ' - '+ uuid.v4();
	// Place these in the closure, to be propulated async by before logic
	const agent_string_1= 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36'+ uid;
	const agent_string_2= 'Mozilla/5.0 (Linux; Android 4.1; Nexus 7 Build/JRN84D) AppleWebKit/535.19 (KHTML, like Gecko) Chrome/18.0.1025.166 Safari/535.19'+ uid;
	const agent_string_3= 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2272.118 Safari/537.36'+ uid+ ' #PRE-ENTERED';
	const agent_string_4= 'curl/7.19.7 (i386-redhat-linux-gnu)'+ uid;
	let next_expected_id= 0;
	let already_added_id= 0;
	let module= false; // This is the module under test (appears in DVblueprint in kit.services upon startup)
	const base_ctx= {log: {debug: console.log}};
	const db_stuff= [];

	let kit= false; // Closure
	let sdb= false; // Closure
	after(() => kit.services.server != null ? kit.services.server.server.close() : undefined);
	before(() => Promise.resolve()
    .then(function() {
        const config_extra= {
            db: {
                mysql: {
                    pool: {
                        level2_debug: true
                    },
                    modules: {
                        agent_header: {file: 'lib/db/_mysql/sql_agent_header'}
                    }
                }
            }, // Remove node_modules/blueprint/
            service_modules: {
                db: { file: 'lib/db'
            }, // Remove node_modules/blueprint/
                AgentHeader: { file: 'lib/agent_header'
            }
            } // Remove node_modules/blueprint/
        };
        const mysql_mods= [];
        mysql_mods.push('agent_header');
        return server.start(false, [ 'AgentHeader', ], [], true, mysql_mods, false, config_extra);}).then(function(the_kit){
        kit= the_kit;
        module= kit.services.AgentHeader;
        sdb= kit.services.db.mysql;

        // wrapper was populating ctx.conn
        return sdb.core.Acquire();}).then(function(c) {
        base_ctx.conn= c;

        // Have a DB entry so it is not in the cache
        return sdb.core.sqlQuery(base_ctx, 'INSERT INTO agent_header (agent_header, agent_header_md5) VALUES (?, MD5(?))', [agent_string_3, agent_string_3]);})
    .then(function(db_results){
        already_added_id= db_results.insertId;

        // Get spot to start to track what this module generates
        return sdb.core.sqlQuery(base_ctx, 'SELECT id FROM agent_header ORDER BY id desc LIMIT 1');}).then(db_rows => next_expected_id= db_rows.length ? db_rows[ 0].id+ 1 : 1));

	it('adds', function(){
		let s= false;
		return Promise.resolve()
		.then(() => module.xlate(s= agent_string_1+ ` #${next_expected_id}`)).then(function(id){
			// Add
			({agent_string_1: s, id}.should.deep.equal({ agent_string_1: s, id: next_expected_id}));
			return ++next_expected_id;
		});
	});

	it('adds+find_cache', function(){
		let s= false;
		return Promise.resolve()
		.then(() => // Add
        module.xlate(s= agent_string_2+ ` #${next_expected_id}`)).then(function(id){
			({agent_string_2: s, id}.should.deep.equal({ agent_string_2: s, id: next_expected_id}));

			// Find
			return module.xlate(s);}).then(function(id){
			({agent_string_2: s, id}.should.deep.equal({ agent_string_2: s, id: next_expected_id}));

			return ++next_expected_id;
		});
	});

	it('find-db', () => Promise.resolve()
    .then(() => module.xlate(agent_string_3)).then(function(id){
        // Find
        ({agent_string_3, id}.should.deep.equal({ agent_string_3, id: already_added_id}));
        return ++next_expected_id;
    })); // Because, finding an existing non-cache entry, will bump the autoincrement primary index

	return it('handles simultaineous updates', function(){
		const expected= [];
		return Promise.resolve()
		.then(function() {
			//TODO p= Promise.resolve()
			const p= [];
			for (let i = 1; i <= 20; i++) {
				var s;
				p.push(s= module.xlate(agent_string_4+ ' #'+ next_expected_id));
				expected.push(next_expected_id);
				p.push(s);
				expected.push(next_expected_id);
				++next_expected_id;
			}
			return Promise.all(p);}).then(id_array => // Find
        id_array.should.deep.equal(expected));
	});
});

