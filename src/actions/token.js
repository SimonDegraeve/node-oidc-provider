'use strict';

const compose = require('koa-compose');

const presence = require('../helpers/validate_presence');
const instance = require('../helpers/weak_cache');

const noCache = require('../shared/no_cache');
const authAndParams = require('../shared/chains/client_auth');

module.exports = function tokenAction(provider) {
  return compose([
    noCache,

    authAndParams(provider, instance(provider).grantTypeWhitelist),

    async function supportedGrantTypeCheck(ctx, next) {
      presence.call(this, ['grant_type']);

      const supported = provider.configuration('grantTypes');

      this.assert(supported.has(this.oidc.params.grant_type), 400, 'unsupported_grant_type', {
        error_description: `unsupported grant_type requested (${this.oidc.params.grant_type})`,
      });

      await next();
    },

    async function allowedGrantTypeCheck(ctx, next) {
      const oidc = this.oidc;

      this.assert(oidc.client.grantTypeAllowed(oidc.params.grant_type), 400,
        'restricted_grant_type', {
          error_description: 'requested grant type is restricted to this client',
        });

      await next();
    },

    async function callTokenHandler(ctx, next) {
      const grantType = this.oidc.params.grant_type;

      const grantTypeHandlers = instance(provider).grantTypeHandlers;
      /* istanbul ignore else */
      if (grantTypeHandlers.has(grantType)) {
        await grantTypeHandlers.get(grantType).call(this, next);
        provider.emit('grant.success', this);
      } else {
        this.throw(500, 'server_error', {
          error_description: 'not implemented grant type',
        });
      }
    },
  ]);
};
