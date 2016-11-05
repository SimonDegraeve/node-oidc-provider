'use strict';

module.exports = function getSessionHandler(provider) {
  return async function sessionHandler(ctx, next) {
    this.oidc.session = await provider.Session.get(this);
    await next();

    if (this.oidc.session.transient) {
      this.response.get('set-cookie').forEach((cookie, index, ary) => {
        if (cookie.startsWith('_session') && !cookie.includes('expires=Thu, 01 Jan 1970')) {
          ary[index] = cookie.replace(/(; ?expires=([\w\d:, ]+))/, '');
        }
      });
    }

    await this.oidc.session.save();
  };
};
