'use strict';

const _ = require('lodash');
const errors = require('../../helpers/errors');

module.exports = (provider) => {
  const AccessToken = provider.AccessToken;
  const AuthorizationCode = provider.AuthorizationCode;
  const IdToken = provider.IdToken;

  async function tokenHandler(ctx) {
    const at = new AccessToken({
      accountId: ctx.oidc.session.accountId(),
      claims: ctx.oidc.claims,
      clientId: ctx.oidc.client.clientId,
      grantId: ctx.oidc.uuid,
      scope: ctx.oidc.params.scope,
      sid: ctx.oidc.session.sidFor(ctx.oidc.client.clientId),
    });

    return {
      access_token: await at.save(),
      expires_in: AccessToken.expiresIn,
      token_type: 'Bearer',
    };
  }

  async function codeHandler(ctx) {
    const ac = new AuthorizationCode({
      accountId: ctx.oidc.session.accountId(),
      acr: ctx.oidc.session.acr(ctx.oidc.uuid),
      authTime: ctx.oidc.session.authTime(),
      claims: ctx.oidc.claims,
      clientId: ctx.oidc.client.clientId,
      codeChallenge: ctx.oidc.params.code_challenge,
      codeChallengeMethod: ctx.oidc.params.code_challenge_method,
      grantId: ctx.oidc.uuid,
      nonce: ctx.oidc.params.nonce,
      redirectUri: ctx.oidc.params.redirect_uri,
      scope: ctx.oidc.params.scope,
    });

    if (provider.configuration('features.backchannelLogout')) {
      ac.sid = ctx.oidc.session.sidFor(ctx.oidc.client.clientId);
    }

    return { code: await ac.save() };
  }

  function idTokenHandler(ctx) {
    const token = new IdToken(
      Object.assign({}, ctx.oidc.account.claims(), {
        acr: ctx.oidc.session.acr(ctx.oidc.uuid),
        auth_time: ctx.oidc.session.authTime(),
      }), ctx.oidc.client.sectorIdentifier);

    token.scope = ctx.oidc.params.scope;
    token.mask = _.get(ctx.oidc.claims, 'id_token', {});

    token.set('nonce', ctx.oidc.params.nonce);

    if (provider.configuration('features.backchannelLogout')) {
      token.set('sid', ctx.oidc.session.sidFor(ctx.oidc.client.clientId));
    }

    return { id_token: token };
  }

  function noneHandler() {
    return {};
  }

  function callHandlers(ctx, responseType) {
    let fn;
    switch (responseType) {
      case 'none':
        fn = noneHandler(ctx);
        break;
      case 'token':
        fn = tokenHandler(ctx);
        break;
      case 'id_token':
        fn = idTokenHandler(ctx);
        break;
      case 'code':
        fn = codeHandler(ctx);
        break;
      /* istanbul ignore next */
      default:
        throw new errors.InvalidRequestError('not implemented', 501);
    }

    return fn;
  }

  /*
   * Resolves each requested response type to a single response object. If one of the hybrid
   * response types is used an appropriate _hash is also pushed on to the id_token.
   */
  return async function processResponseTypes(ctx) {
    const responses = ctx.oidc.params.response_type.split(' ');
    const out = Object.assign.apply({}, await Promise.all(responses.map(responseType => callHandlers(ctx, responseType))));

    if (out.access_token && out.id_token) {
      out.id_token.set('at_hash', out.access_token);
    }

    if (out.code && out.id_token) {
      out.id_token.set('c_hash', out.code);
    }

    if (out.id_token) {
      out.id_token = await out.id_token.sign(ctx.oidc.client);
    }

    return out;
  };
};