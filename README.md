# oidc-provider

[![build][travis-image]][travis-url] [![dependencies][david-image]][david-url] [![codecov][codecov-image]][codecov-url] [![npm][npm-image]][npm-url] [![licence][licence-image]][licence-url]

oidc-provider is an OpenID Provider implementation of [OpenID Connect][openid-connect]. It allows to
export a complete mountable or standalone OpenID Provider implementation. This implementation does
not force you into any data models or persistance stores, instead it expects you to provide an
adapter. A generic in memory adapter is available to get you started.

The provided examples also implement simple user interaction views but those are not forced on you
as they do not come as part of the exported application, instead you are encouraged to implement
your own unique-looking and functioning user flows.

**Table of Contents**

  * [Implemented specs &amp; features](#implemented-specs--features)
  * [Get started](#get-started)
  * [Configuration](#configuration)
    * [Available Claims](#available-claims)
    * [Features](#features)
    * [Routes](#routes)
    * [Certificates](#keys-for-signing-and-encryption)
    * [Persistance](#persistance)
    * [Accounts](#accounts)
    * [Interaction](#interaction)
    * [Clients](#clients)
    * [Custom Grant Types](#custom-grant-types)
    * [Custom Discovery Properties](#custom-discovery-properties)
    * [OAuth Token Integrity](#oauth-token-integrity)
    * [Changing HTTP request defaults](#changing-http-request-defaults)
  * [Events](#events)
  * [Certification](#certification)

## Implemented specs & features

The following specifications are implemented by oidc-provider.

- [OpenID Connect Core 1.0 incorporating errata set 1][feature-core]
  - Authorization
    - Authorization Code Flow
    - Implicit Flow
    - Hybrid Flow
    - proper handling for parameters
      - claims
      - request
      - request_uri
      - acr_values
      - id_token_hint
      - max_age
  - Scopes
  - Claims
    - Normal Claims
    - Aggregated Claims
    - Distributed Claims
  - UserInfo Endpoint and ID Tokens including
    - Signing - Asymmetric and Symmetric
    - Encryption - Asymmetric and Symmetric
  - Passing a Request Object by Value or Reference including
    - Signing - Asymmetric and Symmetric
    - Encryption - Asymmetric using RSA or Elliptic Curve
  - Subject Identifier Types
    - public
    - pairwise
  - Offline Access / Refresh Token Grant
  - Client Credentials Grant
  - Client Authentication
    - client_secret_basic
    - client_secret_post
    - client_secret_jwt
    - private_key_jwt
- [OpenID Connect Discovery 1.0 incorporating errata set 1][feature-discovery]
- [OpenID Connect Dynamic Client Registration 1.0 incorporating errata set 1][feature-registration]
- [OAuth 2.0 Form Post Response mode][feature-form-post]
- [RFC7636 - Proof Key for Code Exchange by OAuth Public Clients][feature-pixy]
- [RFC7009 - OAuth 2.0 Token revocation][feature-revocation]
- [RFC7662 - OAuth 2.0 Token introspection][feature-introspection]

The following drafts/experimental specifications are implemented by oidc-provider.
- [OpenID Connect Session Management 1.0 - draft 27][feature-session-management]
- [OpenID Connect Back-Channel Logout 1.0 - draft 03][feature-backchannel-logout]
- [RFC7592 - OAuth 2.0 Dynamic Client Registration Management Protocol (Update and Delete)][feature-registration-management]

Updates to drafts and experimental specifications are released as MINOR versions.


## Get started
To run and experiment with an example server, clone the oidc-provider repo and install the dependencies:

```bash
$ git clone https://github.com/panva/node-oidc-provider.git oidc-provider
$ cd oidc-provider
$ npm install
$ node example
```
Visiting `http://localhost:3000/.well-known/openid-configuration` will help you to discover how the
example is [configured](example).

This example is also deployed and available for you to experiment with [here][heroku-example].
An example client using this provider is available [here][heroku-example-client]
(uses [openid-client][openid-client]).

Otherwise just install the package in your app and follow the [example use](example/index.js).
It is easy to use with [express](example/express.js) too.
```
$ npm install oidc-provider --save
```


## Configuration
```js
const Provider = require('oidc-provider').Provider;
const issuer = 'http://localhost:3000';
const configuration = {
  // ... see available options below
};
const clients = [ ... ];

const oidc = new Provider(issuer, configuration);
oidc.initialize({ clients }).then(function () {
  console.log(oidc.app); // => koa application
  console.log(oidc.app.callback()); // => express style application callback
});
```
[Available configuration](md/configuration.md), [Default configuration values](lib/helpers/defaults.js).

## Events
The oidc-provider instance is an event emitter, `this` is always the instance. In events where `ctx`
(request context) is passed to the listener `ctx.oidc` holds additional details like recognized
parameters, loaded client or session.

**server_error**  
oidc.on(`'server_error', function (error, ctx) { }`)  
Emitted when an exception is thrown or promise rejected from either the Provider or your provided
adapters. If it comes from the library you should probably report it.

**authorization.accepted**  
oidc.on(`'authorization.accepted', function (ctx) { }`)  
Emitted with every syntactically correct authorization request pending resolving.

**interaction.started**  
oidc.on(`'interaction.started', function (detail, ctx) { }`)  
Emitted when interaction is being requested from the end-user.

**interaction.ended**  
oidc.on(`'interaction.ended', function (ctx) { }`)  
Emitted when interaction has been resolved and the authorization request continues being processed.

**authorization.success**  
oidc.on(`'authorization.success', function (ctx) { }`)  
Emitted with every successfully completed authorization request. Useful i.e. for collecting metrics
or triggering any action you need to execute after succeeded authorization.

**authorization.error**  
oidc.on(`'authorization.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `authorization` endpoint.

**grant.success**  
oidc.on(`'grant.success', function (ctx) { }`)  
Emitted with every successful grant request. Useful i.e. for collecting metrics or triggering any
action you need to execute after succeeded grant.

**grant.error**  
oidc.on(`'grant.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `grant` endpoint.

**certificates.error**  
oidc.on(`'certificates.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `certificates` endpoint.

**discovery.error**  
oidc.on(`'discovery.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `discovery` endpoint.

**introspection.error**  
oidc.on(`'introspection.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `introspection` endpoint.

**revocation.error**  
oidc.on(`'revocation.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `revocation` endpoint.

**registration_create.success**  
oidc.on(`'registration_create.success', function (client, ctx) { }`)  
Emitted with every successful client registration request.

**registration_create.error**  
oidc.on(`'registration_create.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the POST `registration` endpoint.

**registration_read.error**  
oidc.on(`'registration_read.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the GET `registration` endpoint.

**registration_update.success**  
oidc.on(`'registration_update.success', function (client, ctx) { }`)  
Emitted with every successful update client registration request.

**registration_update.error**  
oidc.on(`'registration_update.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the PUT `registration` endpoint.

**registration_delete.success**  
oidc.on(`'registration_delete.success', function (client, ctx) { }`)  
Emitted with every successful delete client registration request.

**registration_delete.error**  
oidc.on(`'registration_delete.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the DELETE `registration` endpoint.

**userinfo.error**  
oidc.on(`'userinfo.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `userinfo` endpoint.

**check_session.error**  
oidc.on(`'check_session.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `check_session` endpoint.

**end_session.error**  
oidc.on(`'end_session.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `end_session` endpoint.

**webfinger.error**  
oidc.on(`'webfinger.error', function (error, ctx) { }`)  
Emitted when a handled error is encountered in the `webfinger` endpoint.

**token.issued**  
oidc.on(`'token.issued', function (token) { }`)  
Emitted when a token is issued. All tokens extending `OAuthToken` emit this event.
token can be one of `AccessToken`, `AuthorizationCode`,
`ClientCredentials`, `RefreshToken`.

**token.consumed**  
oidc.on(`'token.consumed', function (token) { }`)  
Emitted when a token (actually just AuthorizationCode) is used.

**token.revoked**  
oidc.on(`'token.revoked', function (token) { }`)  
Emitted when a token is about to be revoked.

**grant.revoked**  
oidc.on(`'grant.revoked', function (grantId) { }`)  
Emitted when tokens resulting from a single grant are about to be revoked.
`grantId` is uuid formatted string. Use this to cascade the token revocation in cases where your
adapter cannot provides functionality.


## Certification
![openid_certified][openid-certified-logo]

[OpenID Certified™][openid-certified-link] by Filip Skokan to the OP Basic, OP Implicit, OP Hybrid,
OP Config and OP Dynamic profiles of the OpenID Connect™ protocol.

[travis-image]: https://img.shields.io/travis/panva/node-oidc-provider/master.svg?style=flat-square&maxAge=7200
[travis-url]: https://travis-ci.org/panva/node-oidc-provider
[david-image]: https://img.shields.io/david/panva/node-oidc-provider.svg?style=flat-square&maxAge=7200
[david-url]: https://david-dm.org/panva/node-oidc-provider
[codecov-image]: https://img.shields.io/codecov/c/github/panva/node-oidc-provider/master.svg?style=flat-square&maxAge=7200
[codecov-url]: https://codecov.io/gh/panva/node-oidc-provider
[npm-image]: https://img.shields.io/npm/v/oidc-provider.svg?style=flat-square&maxAge=7200
[npm-url]: https://www.npmjs.com/package/oidc-provider
[licence-image]: https://img.shields.io/github/license/panva/node-oidc-provider.svg?style=flat-square&maxAge=7200
[licence-url]: LICENSE.md
[openid-certified-link]: http://openid.net/certification/
[openid-certified-logo]: https://cloud.githubusercontent.com/assets/1454075/7611268/4d19de32-f97b-11e4-895b-31b2455a7ca6.png
[openid-connect]: http://openid.net/connect/
[feature-core]: http://openid.net/specs/openid-connect-core-1_0.html
[feature-discovery]: http://openid.net/specs/openid-connect-discovery-1_0.html
[feature-registration]: http://openid.net/specs/openid-connect-registration-1_0.html
[feature-session-management]: http://openid.net/specs/openid-connect-session-1_0-27.html
[feature-form-post]: http://openid.net/specs/oauth-v2-form-post-response-mode-1_0.html
[feature-revocation]: https://tools.ietf.org/html/rfc7009
[feature-introspection]: https://tools.ietf.org/html/rfc7662
[feature-thumbprint]: https://tools.ietf.org/html/rfc7638
[feature-pixy]: https://tools.ietf.org/html/rfc7636
[node-jose]: https://github.com/cisco/node-jose
[heroku-example]: https://guarded-cliffs-8635.herokuapp.com/op/.well-known/openid-configuration
[heroku-example-client]: https://tranquil-reef-95185.herokuapp.com/client
[openid-client]: https://github.com/panva/node-openid-client
[feature-backchannel-logout]: http://openid.net/specs/openid-connect-backchannel-1_0-03.html
[feature-registration-management]: https://tools.ietf.org/html/rfc7592
