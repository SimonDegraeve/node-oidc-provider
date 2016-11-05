'use strict';

const errors = require('../helpers/errors');

module.exports = async function invalidRoute(ctx, next) {
  await next();
  if (this.status === 404 && this.message === 'Not Found') {
    this.throw(new errors.InvalidRequestError('unrecognized route', 404));
  }
};
