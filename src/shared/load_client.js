'use strict';

const errors = require('../helpers/errors');

module.exports = function getLoadClient(provider) {
  return async function loadClient(ctx, next) {
    const client = await provider.Client.find(this.oidc.authorization.clientId);

    this.assert(client, new errors.InvalidClientError(
      'invalid client authentication provided (client not found)'));

    this.oidc.client = client;

    await next();
  };
};
