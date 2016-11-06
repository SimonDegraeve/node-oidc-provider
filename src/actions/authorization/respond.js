'use strict';

const crypto = require('crypto');
const url = require('url');

const instance = require('../../helpers/weak_cache');
const redirectUri = require('../../helpers/redirect_uri');
const formPost = require('../../shared/form_post');

function locationOrigin(uri) {
  return url.format(Object.assign(url.parse(uri), {
    hash: null,
    pathname: null,
    search: null,
  }));
}

/*
 * Based on the authorization request response mode either redirects with parameters in query or
 * fragment or renders auto-submitting form with the response members as hidden fields.
 *
 * If session management is supported stores User-Agent readable cookie with the session stated
 * used by the OP iframe to detect session state changes.
 *
 * @emits: authorization.success
 */
module.exports = provider => async function respond(ctx, next) {
  const out = await next();

  if (ctx.oidc.params.state !== undefined) out.state = ctx.oidc.params.state;

  provider.emit('authorization.success', ctx);

  if (provider.configuration('features.sessionManagement')) {
    const salt = crypto.randomBytes(8).toString('hex');
    const state = String(ctx.oidc.session.authTime());

    const shasum = crypto.createHash('sha256')
      .update(ctx.oidc.params.client_id)
      .update(' ')
      .update(locationOrigin(ctx.oidc.params.redirect_uri))
      .update(' ')
      .update(state)
      .update(' ')
      .update(salt);

    const sessionStr = shasum.digest('hex');

    const stateCookieName = `_state.${ctx.oidc.params.client_id}`;
    ctx.cookies.set(stateCookieName, state,
      Object.assign({}, provider.configuration('cookies.long'), { httpOnly: false }));

    out.session_state = `${sessionStr}.${salt}`;
  }

  if (instance(provider).responseModes.has(ctx.oidc.params.response_mode)) {
    instance(provider).responseModes.get(ctx.oidc.params.response_mode).call(ctx, ctx.oidc.params.redirect_uri, out);
  } else if (ctx.oidc.params.response_mode === 'form_post') {
    formPost(ctx, ctx.oidc.params.redirect_uri, out);
  } else {
    const uri = redirectUri(ctx.oidc.params.redirect_uri, out, ctx.oidc.params.response_mode);
    ctx.redirect(uri);
  }
};