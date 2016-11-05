'use strict';

module.exports.handler = function getClientCredentialsHandler(provider) {
  return async function clientCredentialsResponse(ctx, next) {
    const ClientCredentials = provider.ClientCredentials;
    const at = new ClientCredentials({
      clientId: this.oidc.client.clientId,
      scope: this.oidc.params.scope,
    });

    const token = await at.save();
    const tokenType = 'Bearer';
    const expiresIn = ClientCredentials.expiresIn;

    this.body = {
      access_token: token,
      expires_in: expiresIn,
      token_type: tokenType,
    };

    await next();
  };
};

module.exports.parameters = ['scope'];
