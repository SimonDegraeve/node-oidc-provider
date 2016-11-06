'use strict';

const url = require('url');
const _ = require('lodash');
const errors = require('../../helpers/errors');
const mask = require('../../helpers/claims');

const j = JSON.stringify;

module.exports = (provider) => {
  const Claims = mask(provider.configuration());

  return async function interactions(ctx, next) {
    const clientName = _.get(ctx.oidc.client, 'name', 'Client');

    const interactionChecks = [

      // no account id was found in the session info
      async () => {
        if (!ctx.oidc.session.accountId()) {
          return {
            error: 'login_required',
            error_description: 'End-User authentication is required',
            reason: 'no_session',
            reason_description: 'Please Sign-in to continue.',
          };
        }
        return false;
      },

      // login was requested by the client by prompt parameter
      async () => {
        if (ctx.oidc.prompted('login')) {
          return {
            error: 'login_required',
            error_description: 'End-User authentication could not be obtained',
            reason: 'login_prompt',
            reason_description: `${clientName} asks you to Sign-in again.`,
          };
        }
        return false;
      },

      // session is too old for this authorization request
      async () => {
        if (ctx.oidc.session.past(ctx.oidc.params.max_age)) {
          return {
            error: 'login_required',
            error_description: 'End-User re-authentication could not be obtained',
            reason: 'max_age',
            reason_description: `${clientName} asks you to Sign-in again.`,
          };
        }
        return false;
      },

      // session subject value differs from the one requested
      async () => {
        if (_.has(ctx.oidc.claims, 'id_token.sub.value')) {
          const subject = Claims.sub(ctx.oidc.session.accountId(), ctx.oidc.client.sectorIdentifier);
          if (ctx.oidc.claims.id_token.sub.value !== subject) {
            return {
              error: 'login_required',
              error_description: 'requested subject could not be obtained',
              reason: 'claims_id_token_sub_value',
              reason_description:
              `${clientName} asks you to Sign-in with a specific identity.`,
            };
          }
        }
        return false;
      },

      // none of multiple authentication context class references requested
      // are met
      async () => {
        const request = _.get(ctx.oidc.claims, 'id_token.acr', {});
        if (request.essential && request.values) {
        
          if (request.values.indexOf(ctx.oidc.session.acr()) === -1) {
            return {
              error: 'login_required',
              error_description: 'none of the requested ACRs could not be obtained',
              reason: 'essential_acrs',
              reason_description: `${clientName} asks you to Sign-in using a specific method.`,
            };
          }
        }
        return false;
      },

      // single requested authentication context class reference is not met
      async () => {
        const request = _.get(ctx.oidc.claims, 'id_token.acr', {});
        if (request.essential && request.value) {
          if (request.value !== ctx.oidc.session.acr()) {
            return {
              error: 'login_required',
              error_description: 'requested ACR could not be obtained',
              reason: 'essential_acr',
              reason_description: `${clientName} asks you to Sign-in using a specific method.`,
            };
          }
        }
        return false;
      },

      // any unfulfilled prompts other than none or login
      async () => {
        const missed = _.find(ctx.oidc.prompts, (prompt) => {
          if (prompt !== 'none' && ctx.oidc.prompted(prompt)) {
            return true;
          }
          return false;
        });

        if (missed) {
          return {
            error: missed === 'consent' ? 'consent_required' : 'interaction_required',
            error_description: `prompt ${missed} was not resolved`,
            reason: `${missed}_prompt`,
          };
        }

        return false;
      },

      // client not authorized in session yet
      // TODO: strategies
      // - authorize once per session
      // - pass everyone
      // - check account model
      async () => {
        if (!ctx.oidc.session.sidFor(ctx.oidc.client.clientId)) {
          return {
            error: 'consent_required',
            error_description: 'client not authorized for End-User session yet',
            reason: 'client_not_authorized',
          };
        }

        return false;
      },

      async () => {
        if (ctx.oidc.params.id_token_hint !== undefined) {
          const actualSub = Claims.sub(ctx.oidc.session.accountId(), ctx.oidc.client.sectorIdentifier);
          const IdToken = provider.IdToken;
          
          try {
            const decoded = await IdToken.validate(ctx.oidc.params.id_token_hint, ctx.oidc.client)
              if (decoded.payload.sub !== actualSub) {
                return {
                  error: 'login_required',
                  error_description: 'id_token_hint and authenticated subject do not match',
                  reason: 'id_token_hint',
                  reason_description: `${clientName} asks that you Sign-in with a specific identity.`,
                };
              }

              return false;
          }
          catch (err) {
            throw new errors.InvalidRequestError(`could not validate id_token_hint (${err.message})`);
          }
        }

        return false;
      },
    ];

    let interaction;

    for (const fn of interactionChecks) {
      interaction = await fn();
      // if (interaction instanceof Promise) interaction = await Promise.resolve(interaction);
      // interaction = await Promise.resolve(fn());
      if (interaction) break;
    }

    if (interaction) {
      _.defaults(interaction, {
        error: 'interaction_required',
        error_description: 'interaction is required from the end-user',
      });

      // if interaction needed but prompt=none => throw;
      ctx.assert(!ctx.oidc.prompted('none'), 302, interaction.error, {
        error_description: interaction.error_description,
      });

      const destination = provider.configuration('interactionUrl')(ctx, interaction);
      const cookieOptions = provider.configuration('cookies.short');

      ctx.cookies.set('_grant', j({
        interaction,
        uuid: ctx.oidc.uuid,
        returnTo: ctx.oidc.urlFor('resume', { grant: ctx.oidc.uuid }),
        params: ctx.oidc.params,
      }), Object.assign({ path: url.parse(destination).pathname }, cookieOptions));

      ctx.cookies.set('_grant', j(ctx.oidc.params), Object.assign({
        path: provider.pathFor('resume', { grant: ctx.oidc.uuid }),
      }, cookieOptions));

      provider.emit('interaction.started', interaction, ctx);
      return ctx.redirect(destination);
    }

    return await next();
  };
};
