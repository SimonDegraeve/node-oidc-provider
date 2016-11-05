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
  const loadClient = async function loadClient(clientId) {
    // Validate: client_id param
    const client = await provider.Client.find(clientId);

    this.assert(client, new errors.InvalidClientError('unrecognized azp or aud claims'));

    return client;
  };

  return {
    get: compose([
      paramsMiddleware(['id_token_hint', 'post_logout_redirect_uri', 'state']),

      rejectDupes,

      async function endSessionChecks(ctx, next) {
        const params = this.oidc.params;

        if (params.id_token_hint) {
          let client;
          let clientId;

          try {
            const jot = JWT.decode(params.id_token_hint);
            clientId = jot.payload.azp || jot.payload.aud;
          } catch (err) {
            this.throw(new errors.InvalidRequestError(
              `could not decode id_token_hint (${err.message})`));
          }

          try {
            client = await loadClient.call(this, clientId);
            await provider.IdToken.validate(params.id_token_hint, client);
          } catch (err) {
            this.throw(new errors.InvalidRequestError(
              `could not validate id_token_hint (${err.message})`));
          }

          if (params.post_logout_redirect_uri) {
            this.assert(client.postLogoutRedirectUriAllowed(params.post_logout_redirect_uri),
              new errors.InvalidRequestError('post_logout_redirect_uri not registered'));
          }

          this.oidc.client = client;
        } else {
          params.post_logout_redirect_uri = undefined;
        }

        await next();
      },

      async function renderLogout(ctx, next) {
        const secret = crypto.randomBytes(24).toString('hex');

        this.oidc.session.logout = {
          secret,
          clientId: this.oidc.client ? this.oidc.client.clientId : undefined,
          postLogoutRedirectUri: this.oidc.params.post_logout_redirect_uri ||
            provider.configuration('postLogoutRedirectUri'),
        };

        this.type = 'html';
        this.status = 200;

        const formhtml = `<form id="op.logoutForm" method="post" action="${provider.pathFor('end_session')}"><input type="hidden" name="xsrf" value="${secret}"/></form>`; // eslint-disable-line max-len
        provider.configuration('logoutSource').call(this, formhtml);

        await next();
      },
    ]),

    post: compose([
      parseBody,

      paramsMiddleware(['xsrf', 'logout']),

      rejectDupes,

      async function checkLogoutToken(ctx, next) {
        this.assert(this.oidc.session.logout, new errors.InvalidRequestError(
          'could not find logout details'));
        this.assert(this.oidc.session.logout.secret === this.oidc.params.xsrf,
          new errors.InvalidRequestError('xsrf token invalid'));
        await next();
      },

      async function endSession(ctx, next) {
        const params = this.oidc.session.logout;

        const cookieOpts = _.omit(provider.configuration('cookies.long'), 'maxAge', 'signed');

        if (this.oidc.params.logout) {
          if (provider.configuration('features.backchannelLogout')) {
            try {
              const Client = provider.Client;
              const clientIds = Object.keys(this.oidc.session.authorizations);
              const logouts = clientIds.map(visitedClientId => Client.find(visitedClientId)
                .then((visitedClient) => {
                  if (visitedClient && visitedClient.backchannelLogoutUri) {
                    return visitedClient.backchannelLogout(this.oidc.session.accountId(),
                      this.oidc.session.sidFor(visitedClient.clientId));
                  }
                  return undefined;
                }));

              await Promise.all(logouts);
            } catch (err) {}
          }

          await this.oidc.session.destroy();

          // get all cookies matching _state.[clientId](.sig) and drop them
          this.get('cookie').match(STATES).forEach(val => this.cookies.set(val.slice(0, -1), null,
            cookieOpts));

          this.cookies.set('_session', null, cookieOpts);
          this.cookies.set('_session.sig', null, cookieOpts);
        } else if (params.clientId) {
          delete this.oidc.session.authorizations[params.clientId];
          this.cookies.set(`_state.${params.clientId}`, null, cookieOpts);
          this.cookies.set(`_state.${params.clientId}.sig`, null, cookieOpts);
        }

        const uri = redirectUri(params.postLogoutRedirectUri,
          params.state != null ? { state: params.state } : undefined); // eslint-disable-line eqeqeq

        this.redirect(uri);

        await next();
      },
    ]),
  };
};
