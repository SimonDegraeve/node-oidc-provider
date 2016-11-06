'use strict';

const _ = require('lodash');
const errors = require('../../helpers/errors');

/*
 * Validates that all requested scopes are supported by the provider, that openid is amongst them
 * and that offline_access prompt is requested together with consent scope
 *
 * @throws: invalid_request
 */
module.exports = provider => async function checkScope(ctx, next) {
  const scopes = ctx.oidc.params.scope.split(' ');

  const unsupported = _.difference(scopes, provider.configuration('scopes'));
  ctx.assert(_.isEmpty(unsupported), new errors.InvalidRequestError(
    `invalid scope value(s) provided. (${unsupported.join(',')})`));

  ctx.assert(scopes.indexOf('openid') !== -1,
    new errors.InvalidRequestError('openid is required scope'));

  if (scopes.indexOf('offline_access') !== -1 && ctx.oidc.prompts.indexOf('consent') === -1) {
    ctx.throw(new errors.InvalidRequestError('offline_access scope requires consent prompt'));
  }

  await next();
};
