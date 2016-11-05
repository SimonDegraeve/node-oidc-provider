'use strict';

module.exports = async function noCache(ctx, next) {
  this.set('Pragma', 'no-cache');
  this.set('Cache-Control', 'no-cache, no-store');
  await next();
};
