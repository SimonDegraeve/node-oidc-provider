'use strict';

module.exports = provider => async function authorizationEmit(ctx, next) {
  if (this.oidc.result) {
    provider.emit('interaction.ended', this);
  } else {
    provider.emit('authorization.accepted', this);
  }
  
  await next();
};
