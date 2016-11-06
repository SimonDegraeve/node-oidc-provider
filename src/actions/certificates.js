'use strict';

module.exports = function certificatesAction(provider) {
  return async function renderCertificates(ctx, next) {
    ctx.body = provider.keystore.toJSON();

    await next();
  };
};
