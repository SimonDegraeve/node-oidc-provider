'use strict';

const compose = require('koa-compose');

const PARAM_LIST = new Set(['token', 'token_type_hint']);

const presence = require('../helpers/validate_presence');
const authAndParams = require('../shared/chains/client_auth');
const noCache = require('../shared/no_cache');
const mask = require('../helpers/claims');

module.exports = function introspectionAction(provider) {
  const Claims = mask(provider.configuration());

  function getAccessToken(token) {
    return provider.AccessToken.find(token, {
      ignoreExpiration: true,
    });
  }

  function getClientCredentials(token) {
    return provider.ClientCredentials.find(token, {
      ignoreExpiration: true,
    });
  }

  function getRefreshToken(token) {
    return provider.RefreshToken.find(token, {
      ignoreExpiration: true,
    });
  }

  function findResult(results) {
    return results.find(found => !!found);
  }

  return compose([

    noCache,

    authAndParams(provider, PARAM_LIST),

    async function validateTokenPresence(ctx, next) {
      presence.call(ctx, ['token']);
      await next();
    },

    async function renderTokenResponse(ctx, next) {
      let token;
      const params = ctx.oidc.params;

      ctx.body = { active: false };

      let tryhard;

      switch (params.token_type_hint) {
        case 'access_token':
          tryhard = getAccessToken(params.token)
            .then((result) => {
              if (result) return result;
              return Promise.all([
                getClientCredentials(params.token),
                getRefreshToken(params.token),
              ]).then(findResult);
            });
          break;
        case 'client_credentials':
          tryhard = getClientCredentials(params.token)
            .then((result) => {
              if (result) return result;
              return Promise.all([
                getAccessToken(params.token),
                getRefreshToken(params.token),
              ]).then(findResult);
            });
          break;
        case 'refresh_token':
          tryhard = getRefreshToken(params.token)
            .then((result) => {
              if (result) return result;
              return Promise.all([
                getAccessToken(params.token),
                getClientCredentials(params.token),
              ]).then(findResult);
            });
          break;
        default:
          tryhard = Promise.all([
            getAccessToken(params.token),
            getClientCredentials(params.token),
            getRefreshToken(params.token),
          ]).then(findResult);
      }

      try {
        token = await Promise.resolve(tryhard);

        switch (token && token.kind) {
          case 'AccessToken':
            ctx.body.token_type = 'access_token';
            break;
          case 'ClientCredentials':
            ctx.body.token_type = 'client_credentials';
            break;
          case 'RefreshToken':
            ctx.body.token_type = 'refresh_token';
            break;
          default:
            return;
        }
      } catch (err) {}

      if (!ctx.body.token_type) {
        return;
      }

      if (token.clientId !== ctx.oidc.client.clientId) {
        ctx.body.sub = Claims.sub(token.accountId,
          (await provider.Client.find(token.clientId)).sectorIdentifier);
      } else {
        ctx.body.sub = Claims.sub(token.accountId, ctx.oidc.client.sectorIdentifier);
      }

      Object.assign(ctx.body, {
        active: token.isValid,
        client_id: token.clientId,
        exp: token.exp,
        iat: token.iat,
        sid: token.sid,
        iss: token.iss,
        jti: token.jti,
        scope: token.scope,
      });

      await next();
    },
  ]);
};