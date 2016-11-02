'use strict';

const jose = require('node-jose');
const assert = require('assert');
const _ = require('lodash');
const instance = require('./weak_cache');

module.exports = function initializeKeystore(conf) {
  if (typeof conf === 'undefined') return false;

  let getKeyStore;
  if (jose.JWK.isKeyStore(conf)) {
    const keystoreWrap = jose.JWK.createKeyStore();
    getKeyStore = Promise.all(_.map(conf.all(), key => keystoreWrap.add(key)))
      .then(() => keystoreWrap);
  } else {
    getKeyStore = Promise.resolve().then(() => jose.JWK.asKeyStore(conf));
  }

  return getKeyStore.then((integrity) => {
    assert(integrity.get(), 'to enable integrity at least one key must be provided');
    instance(this).integrity = integrity;
  });
};
