let lib = false;
const uid= ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (a)=>(a^Math.random()*16>>a/4).toString(16));

const agentString1= `
  Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) 
  Chrome/44.0.2403.157 Safari/537.36 ${uid}`;

const agentString2= `
  Mozilla/5.0 (Linux; Android 4.1; Nexus 7 Build/JRN84D) 
  AppleWebKit/535.19 (KHTML, like Gecko) 
  Chrome/18.0.1025.166 Safari/535.19 ${uid}`;

const agentString3= `
  Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) 
  Chrome/41.0.2272.118 Safari/537.36 ${uid} #PRE-ENTERED`;

const agentString4= `curl/7.19.7 (i386-redhat-linux-gnu) ${uid}`;


describe('xLate', () => {
  before(() => {
    lib = kit.services.AgentHeader;
  });
  it('PARSES AGENT STRING AND PUTS IN DATABASE', async () => {
    const res = await lib.xLate(agentString1);
    res.should.equal(1);
  });
  it('PARSES AGENT STRING 2 AND PUTS IN DATABASE', async () => {
    const res = await lib.xLate(agentString2);
    res.should.equal(2);
  });
  it('PARSES AGENT STRING 3 AND PUTS IN DATABASE', async () => {
    const res = await lib.xLate(agentString3);
    res.should.equal(3);
  });
  it('PARSES AGENT STRING 4 AND PUTS IN DATABASE', async () => {
    const res = await lib.xLate(agentString4);
    res.should.equal(4);
  });
});

describe('_resetMemCacheCount', () => {
  it('RESET MEMCACHE COUNT', () => {
    lib.memcache_count.should.equal(4);
    lib._resetMemCacheCount();
    lib.memcache_count.should.equal(0);
  });
});
