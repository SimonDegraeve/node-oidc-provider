'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const compose = require('koa-compose');

const errors = require('../helpers/errors');
const JWT = require('../helpers/jwt');
const redirectUri = require('../helpers/redirect_uri');

const rejectDupes = require('../shared/check_dupes');
const bodyParser = require('../shared/conditional_body');
const paramsMiddleware = require('../shared/get_params');

const parseBody = bodyParser('application/x-www-form-urlencoded');
const STATES = /_state\.(\S+)=/g;

module.exports = function endSessionAction(provider) {
  const loadClient = async function loadClient(ctx, clientId) {
    // Validate: client_id param
    const client = await provider.Client.find(clientId);

    ctx.assert(client, new errors.InvalidClientError('unrecognized azp or aud claims'));

    return client;
  };

  return {
    get: compose([
      paramsMiddleware(['id_token_hint', 'post_logout_redirect_uri', 'state']),

      rejectDupes,

      async function endSessionChecks(ctx, next) {
        const params = ctx.oidc.params;

        if (params.id_token_hint) {
          let client;
          let clientId;

          try {
            const jot = JWT.decode(params.id_token_hint);
            clientId = jot.payload.azp || jot.payload.aud;
          } catch (err) {
            ctx.throw(new errors.InvalidRequestError(
              `could not decode id_token_hint (${err.message})`));
          }

          try {
            client = await loadClient(ctx, clientId);
            await provider.IdToken.validate(params.id_token_hint, client);
          } catch (err) {
            ctx.throw(new errors.InvalidRequestError(
              `could not validate id_token_hint (${err.message})`));
          }

          if (
            params.post_logout_redirect_uri
            && !client.postLogoutRedirectUriAllowed(params.post_logout_redirect_uri)) {
            throw new errors.InvalidRequestError('post_logout_redirect_uri not registered');
          }

          ctx.oidc.client = client;
        } else {
          params.post_logout_redirect_uri = undefined;
        }

        await next();
      },

      async function renderLogout(ctx, next) {
        const secret = crypto.randomBytes(24).toString('hex');

        ctx.oidc.session.logout = {
          secret,
          clientId: ctx.oidc.client ? ctx.oidc.client.clientId : undefined,
          postLogoutRedirectUri: ctx.oidc.params.post_logout_redirect_uri ||
            provider.configuration('postLogoutRedirectUri'),
        };

        ctx.type = 'html';
        ctx.status = 200;

        const formhtml = `<form id="op.logoutForm" method="post" action="${provider.pathFor('end_session')}"><input type="hidden" name="xsrf" value="${secret}"/></form>`; // eslint-disable-line max-len
        provider.configuration('logoutSource')(ctx, formhtml);

        await next();
      },
    ]),

    post: compose([
      parseBody,

      paramsMiddleware(['xsrf', 'logout']),

      rejectDupes,

      async function checkLogoutToken(ctx, next) {
        ctx.assert(ctx.oidc.session.logout, new errors.InvalidRequestError(
          'could not find logout details'));
        ctx.assert(ctx.oidc.session.logout.secret === ctx.oidc.params.xsrf,
          new errors.InvalidRequestError('xsrf token invalid'));
        await next();
      },

      async function endSession(ctx, next) {
        const params = ctx.oidc.session.logout;

        const cookieOpts = _.omit(provider.configuration('cookies.long'), 'maxAge', 'signed');

        if (ctx.oidc.params.logout) {
          if (provider.configuration('features.backchannelLogout')) {
            try {
              const Client = provider.Client;
              const clientIds = Object.keys(ctx.oidc.session.authorizations);
              const logouts = clientIds.map(visitedClientId => Client.find(visitedClientId)
                .then((visitedClient) => {
                  if (visitedClient && visitedClient.backchannelLogoutUri) {
                    return visitedClient.backchannelLogout(ctx.oidc.session.accountId(),
                      ctx.oidc.session.sidFor(visitedClient.clientId));
                  }
                  return undefined;
                }));

              await Promise.all(logouts);
            } catch (err) {}
          }

          await ctx.oidc.session.destroy();

          // get all cookies matching _state.[clientId](.sig) and drop them
          ctx.get('cookie').match(STATES).forEach(val => ctx.cookies.set(val.slice(0, -1), null,
            cookieOpts));

          ctx.cookies.set('_session', null, cookieOpts);
          ctx.cookies.set('_session.sig', null, cookieOpts);
        } else if (params.clientId) {
          delete ctx.oidc.session.authorizations[params.clientId];
          ctx.cookies.set(`_state.${params.clientId}`, null, cookieOpts);
          ctx.cookies.set(`_state.${params.clientId}.sig`, null, cookieOpts);
        }

        const uri = redirectUri(params.postLogoutRedirectUri,
          params.state != null ? { state: params.state } : undefined); // eslint-disable-line eqeqeq

        ctx.redirect(uri);

        await next();
      },
    ]),
  };
};