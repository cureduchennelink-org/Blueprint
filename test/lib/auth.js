let lib = false;

describe('authenticateBasicAuthHeader', () => {
  let requestObject = {};
  before(() => {
    lib = kit.services.Auth;
  });

  beforeEach(() => {
    requestObject = {
      authorization: {
        scheme: 'Basic',
        basic: {
          username: 'username',
          password: 'password',
        },
      },
    };
  });

  it('SAD MISSING AUTHORIZATION PARAMETER', () => {
    delete requestObject.authorization;
    const res = lib.authenticateBasicAuthHeader(requestObject);
    res.should.equal('MISSING PARAMETER - AUTHORIZATION');
  });
  it('SAD MISSING BASIC PARAMETER', () => {
    delete requestObject.authorization.basic;
    const res = lib.authenticateBasicAuthHeader(requestObject);
    res.should.equal('MISSING PARAMETER - BASIC');
  });
  it('SCHEME IS NOT BASIC', () => {
    requestObject.authorization.scheme = 'NOT BASIC';
    const res = lib.authenticateBasicAuthHeader(requestObject);
    res.should.equal('INVALID SCHEME');
  });
  it('INVALID USERNAME', () => {
    requestObject.authorization.basic.username = 'user';
    const res = lib.authenticateBasicAuthHeader(requestObject);
    res.should.equal('INVALID API KEY');
  });
  it('INVALID PASSWORD', () => {
    requestObject.authorization.basic.password = 'pass';
    const res = lib.authenticateBasicAuthHeader(requestObject);
    res.should.equal('INVALID PASSWORD');
  });
  it('HAPPY', () => {
    const res = lib.authenticateBasicAuthHeader(requestObject);
    res.should.equal(true);
  });
});

describe('validateCredentials', () => {
  before(async () => {
    const password = await lib.encryptPassword('a_password');
    newVals = {
      eml: 'chasen@chasen.com',
      pwd: password,
      role: 'test',
    };

    const res = await kit.services.db.mysql.auth.create(ctx, newVals);
    if (res.affectedRows !== 1) {
      throw new Error('Insert failed!');
    }
  });
  it('INVALID CLIENT!', async () => {
    try {
      await lib.validateCredentials(ctx, 'username', 'password');
    } catch (e) {
      correctError = {
        code: 'INVALID CLIENT',
      };
      return e.body.should.deep.equal(correctError);
    }

    throw new Error('Should fail!');
  });
  it('INVALID PASSWORD', async () => {
    try {
      await lib.validateCredentials(ctx, 'chasen@chasen.com', 'password');
    } catch (e) {
      correctError = {
        code: 'INVALID CLIENT',
      };
      return e.body.should.deep.equal(correctError);
    }

    throw new Error('Should fail!');
  });
  it('HAPPY', async () => {
    const res = await lib.validateCredentials(ctx, 'chasen@chasen.com', 'a_password');
    expectedResponse = {
      id: 100,
      tenant: null,
      role: 'test',
    };
    res.should.deep.equal(expectedResponse);
  });
});

describe('encryptPassword', () => {
  it('HAPPY RETURN A STRING', async () => {
    const res = await lib.encryptPassword('password');
    const isString = typeof res === 'string';
    isString.should.equal(true);
  });
});
describe('_comparePassword', () => {
  it('SAD PASSWORD IS NOT HASHED', async () => {
    try {
      await lib._comparePassword('password', 'password');
    } catch (e) {
      const correctError = {
        code: 'AUTH ERROR',
        message: 'MISSING SALT ON PASSWORD HASH',
      };
      return e.body.should.deep.equal(correctError);
    }

    throw new Error('Should throw error!');
  });
  it('SAD PASSWORD SHOULD NOT MATCH', async () => {
    const password = await lib.encryptPassword('a_password');
    const res = await lib._comparePassword('password', password);
    res.should.equal(false);
  });
  it('HAPPY PASSWORD MATCHES', async () => {
    const password = await lib.encryptPassword('password');
    const res = await lib._comparePassword('password', password);
    res.should.equal(true);
  });
});


