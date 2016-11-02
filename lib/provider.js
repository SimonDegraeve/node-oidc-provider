'use strict';

const pkg = require('../package.json');

const assert = require('assert');
const events = require('events');
const _ = require('lodash');
const url = require('url');

const getConfiguration = require('./helpers/configuration');
const instance = require('./helpers/weak_cache');

const DEFAULT_HTTP_OPTIONS = require('./consts/default_http_options');

const initializeKeystore = require('./helpers/initialize_keystore');
const initializeIntegrity = require('./helpers/initialize_integrity');
const initializeApp = require('./helpers/initialize_app');
const initializeClients = require('./helpers/initialize_clients');

function checkInit(provider) {
  assert(provider.initialized, 'provider must be initialized first, see provider#initialize');
}

class Provider extends events.EventEmitter {

  constructor(issuer, setup) {
    super();

    this.issuer = issuer;

    const conf = getConfiguration(setup);

    instance(this).configuration = function configuration(path) {
      if (path) return _.get(conf, path);
      return conf;
    };

    instance(this).initialized = false;
    instance(this).defaultHttpOptions = _.clone(DEFAULT_HTTP_OPTIONS);
    instance(this).responseModes = new Map();
    instance(this).grantTypeHandlers = new Map();
    instance(this).grantTypeWhitelist = new Set(['grant_type']);
    instance(this).mountPath = url.parse(this.issuer).pathname;
    instance(this).Account = { findById: conf.findById };
  }

  initialize(argz) {
    const args = Object.assign({}, argz);

    return initializeKeystore.call(this, args.keystore)
      .then(() => initializeIntegrity.call(this, args.integrity))
      .then(() => initializeApp.call(this))
      .then(() => initializeClients.call(this, args.clients))
      .then(() => { instance(this).initialized = true; });
  }

  urlFor(name, opt) { return url.resolve(this.issuer, this.pathFor(name, opt)); }

  registerGrantType(name, handlerFactory, params) {
    instance(this).configuration('grantTypes').add(name);

    const grantTypeHandlers = instance(this).grantTypeHandlers;
    const grantTypeWhitelist = instance(this).grantTypeWhitelist;

    grantTypeHandlers.set(name, handlerFactory(this));

    switch (typeof params) {
      case 'undefined':
        break;
      case 'string':
        if (params) grantTypeWhitelist.add(params);
        break;
      default:
        if (params && params.forEach) {
          params.forEach(grantTypeWhitelist.add.bind(grantTypeWhitelist));
        }
    }
  }

  registerResponseMode(name, handler) { instance(this).responseModes.set(name, handler); }

  pathFor(name, opts) {
    const mountPath = (opts && opts.mountPath) || instance(this).mountPath;
    const router = instance(this).router;
    return [mountPath !== '/' ? mountPath : undefined, router.url(name, opts)].join('');
  }

  resume(ctx, grant, result) {
    const resumeUrl = this.urlFor('resume', { grant });
    const path = url.parse(resumeUrl).pathname;
    const opts = _.merge({ path }, instance(this).configuration('cookies.short'));

    ctx.cookies.set('_grant_result', JSON.stringify(result), opts);
    ctx.redirect(resumeUrl);
  }

  httpOptions(values) {
    return _.merge({
      headers: { 'User-Agent': `${pkg.name}/${pkg.version} (${this.issuer}; ${pkg.homepage})` },
    }, this.defaultHttpOptions, values);
  }

  get defaultHttpOptions() { return instance(this).defaultHttpOptions; }

  set defaultHttpOptions(value) {
    instance(this).defaultHttpOptions = _.merge({}, DEFAULT_HTTP_OPTIONS, value);
  }

  get app() { checkInit(this); return instance(this).app; }
  get OAuthToken() { return instance(this).OAuthToken; }
  get Account() { return instance(this).Account; }
  get IdToken() { return instance(this).IdToken; }
  get Client() { return instance(this).Client; }
  get Session() { return instance(this).Session; }
  get AccessToken() { return instance(this).AccessToken; }
  get AuthorizationCode() { return instance(this).AuthorizationCode; }
  get RefreshToken() { return instance(this).RefreshToken; }
  get ClientCredentials() { return instance(this).ClientCredentials; }
  get InitialAccessToken() { return instance(this).InitialAccessToken; }
  get RegistrationAccessToken() { return instance(this).RegistrationAccessToken; }
  get initialized() { return instance(this).initialized; }
}

module.exports = Provider;
