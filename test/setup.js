// got = require('got')
require('mocha');
const fs = require('fs');
const Promise = require('bluebird');
const chai = require('chai');
const {services, routes, mysql} = require('../server_opts');
const blueprint= require('../index');
const resource = 'BEFORE_MOCHA_TEST:';

// global.got = got
global.should = chai.should();

// CRB: 10/09/19: Read the sql dump and reset the database each time you run tests
const readSqlDump = () => {
  const f = '#{resource}readSqlDump::';
  const options = {
    encoding: 'utf-8',
  };
  return new Promise((resolve) => {
    fs.readFile('./db/bootstrap.sql', options, (err, data)=> {
      console.log(f, {err, data});
      if (err) {
        throw new Error('ERROR IN DUMP SQL');
      }
      resolve(data);
    });
  });
};

before(async () => {
  let core = false;
  let dbContents = false;
  const ctx = {
    log: {
      debug: console.log,
    },
  };
  const f = `${resource}`;
  console.log(f, 'starting test server!!');
  const kit = await blueprint.start(true, services, [], true, mysql, false);
  global.kit = kit;
  core = kit.services.db.mysql.core;
  ctx.conn = await core.acquire();
  dbContents = await readSqlDump();
  const {sqlQuery} = core;
  await sqlQuery(ctx, dbContents);
});
