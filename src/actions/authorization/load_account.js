'use strict';

/*
 * Loads the End-User's account referenced by the session.
 */
module.exports = provider => async function loadAccount(ctx, next) {
  const accountId = this.oidc.session.accountId();

  if (accountId) {
    const Account = provider.Account;
    this.oidc.account = await Account.findById(accountId);
  }

  await next();
};
