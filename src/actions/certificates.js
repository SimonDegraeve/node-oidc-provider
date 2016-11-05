'use strict';

module.exports = function certificatesAction(provider) {
  return async function renderCertificates(ctx, next) {
    this.body = provider.keystore.toJSON();

    await next();
  };
};
