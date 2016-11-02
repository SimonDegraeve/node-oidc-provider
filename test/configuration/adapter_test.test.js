'use strict';

const { Provider, AdapterTest } = require('../../lib');
const { TestAdapter } = require('../models');
const jose = require('node-jose');


describe('AdapterTest', function () {
  const integrity = (!process.env.INTEGRITY && Math.floor(Math.random() * 2)) ||
    process.env.INTEGRITY === 'on';

  if (integrity) {
    before(function () {
      const integrityKs = jose.JWK.createKeyStore();
      this.integrity = integrityKs;
      return integrityKs.generate('oct', 512, { alg: 'HS512' });
    });
  }

  before(function () {
    const keystore = jose.JWK.createKeyStore();
    this.keystore = keystore;
    return keystore.generate('RSA', 512);
  });

  it('passes with the default MemoryAdapter', function () {
    const provider = new Provider('http://localhost');

    return provider.initialize({
      integrity: this.integrity,
      keystore: this.keystore,
    }).then(() => {
      const test = new AdapterTest(provider);
      return test.execute();
    });
  });

  it('passes with the TestAdapter', function () {
    const provider = new Provider('http://localhost', {
      adapter: TestAdapter
    });
    return provider.initialize({
      integrity: this.integrity,
      keystore: this.keystore,
    }).then(() => {
      const test = new AdapterTest(provider);
      return test.execute();
    });
  });
});
