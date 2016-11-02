# Configuration

## Available Claims
By default oidc-provider pushes `acr, auth_time, iss, sub` claims to the id token. The `claims`
configuration parameter can be used to define which claims belong to which scope. The configuration
value uses the following scheme:
```js
new Provider('http://localhost:3000', {
  claims: {
    [scope name]: {
      [claim name]: null,
      [claim name]: null,
    },
    [scope name]: {
      [claim name]: null,
    },
    [standalone claim name]: null
  }
});
```

To follow the [Core-defined scope-to-claim mapping][core-account-claims] use:
```js
new Provider('http://localhost:3000', {
  claims: {
    address: { address: null },
    email: { email: null, email_verified: null },
    phone: { phone_number: null, phone_number_verified: null },
    profile: {
      birthdate: null, family_name: null, gender: null, given_name: null, locale: null,
      middle_name: null, name: null, nickname: null, picture: null, preferred_username: null,
      profile: null, updated_at: null, website: null, zoneinfo: null
    }
  }
});
```


## Features

**Discovery**  
Exposes `/.well-known/webfinger` and `/.well-known/openid-configuration` endpoints. Contents of the
latter reflect your actual configuration, i.e. available claims, features and so on.
```js
const configuration = { features: { discovery: Boolean[true] } };
```


**Authorization `claims` parameter**  
Enables the use and validations of `claims` parameter as described in [Core 1.0][core-claims-url]
and the discovery endpoint property `claims_parameter_supported` set to true.
```js
const configuration = { features: { claimsParameter: Boolean[false] } };
```

**Token endpoint `client_credentials` grant**  
Enables `grant_type=client_credentials` to be used on the token endpoint. Note: client still has to
be allowed this grant.  
Hint: allowing this grant together with token introspection and revocation is an easy and elegant
way to allow authorized access to some less sensitive backend actions.
```js
const configuration = { features: { clientCredentials: Boolean[false] } };
```

**Encryption features**  
Enables clients to receive encrypted userinfo responses, encrypted ID Tokens and to send encrypted
request parameters to authorization.
```js
const configuration = { features: { encryption: Boolean[false] } };
```


**Refresh tokens**  
Refresh Tokens will be issued by the authorization_code grant automatically in the following cases:

1) The used authorization code was requested with and granted the offline_access scope and the
client has refresh_token in it's configured grant_types. No extra configuration required.  
2) The OP is configured to always issue a refresh_token and the client has refresh_token in it's
configured grant_types. Configuration below:
```js
const configuration = { features: { refreshToken: Boolean[false] } };
```


**Authorization `request` parameter**  
```js
const configuration = { features: { request: Boolean[false] } };
```
Enables the use and validations of `request` parameter as described in
[Core 1.0][core-jwt-parameters-url] and the discovery endpoint property
`request_parameter_supported` set to true.


**Authorization `request_uri` parameter**  
Enables the use and validations of `request_uri` parameter as described in
[Core 1.0][core-jwt-parameters-url] and the discovery endpoint property
`request_uri_parameter_supported` set to true.
```js
const configuration = { features: { requestUri: Boolean[false] } };
```

To also enable require_request_uri_registration do the following
```js
const configuration = { features: { requestUri: { requireRequestUriRegistration: true } } };
```

**Introspection endpoint**  
Enables the use of Introspection endpoint as described in [RFC7662][feature-introspection] for
tokens of type AccessToken, ClientCredentials and RefreshToken. When enabled the
token_introspection_endpoint property of the discovery endpoint is published, otherwise the property
is not sent. The use of this endpoint is covered by the same authz mechanism as the regular token
endpoint.
```js
const configuration = { features: { introspection: Boolean[false] } };
```

This feature is a recommended way for Resource Servers to validate presented Bearer tokens, since
the token endpoint access must be authorized it is recommended to setup a client for the RS to
use. This client should be unusable for standard authorization flow, to set up such a client provide
grant_types, response_types and redirect_uris as empty arrays.


**Revocation endpoint**  
Enables the use of Revocation endpoint as described in [RFC7009][feature-revocation] for tokens of
type AccessToken, ClientCredentials and RefreshToken. When enabled the
token_revocation_endpoint property of the discovery endpoint is published, otherwise the property
is not sent. The use of this endpoint is covered by the same authz mechanism as the regular token
endpoint.
```js
const configuration = { features: { revocation: Boolean[false] } };
```


**Session management features**  
Enables features described in [Session Management 1.0 - draft 27][feature-session-management].
```js
const configuration = { features: { sessionManagement: Boolean[false] } };
```


**Back-Channel Logout features**  
Enables features described in [Back-Channel Logout 1.0 - draft 03][feature-backchannel-logout].
```js
const configuration = { features: { sessionManagement: true, backchannelLogout: Boolean[false] } };
```


**Dynamic registration features**  
Enables features described in [Dynamic Client Registration 1.0][feature-registration].
```js
const configuration = { features: { registration: Boolean[false] } };
```

To set a fixed Initial Access Token for the POST registration call use
```js
const configuration = { features: { registration: { initialAccessToken: 'tokenValue' } } };
```

To have the option of multiple Initial Access Tokens covered by your adapter use
```js
const configuration = { features: { registration: { initialAccessToken: true } } };

// to add a token and retrieve it's value
new (provider.InitialAccessToken)({}).then(console.log);
```

**Dynamic registration management features**  
Enables Update and Delete features described in
[OAuth 2.0 Dynamic Client Registration Management Protocol][feature-registration-management].
```js
const configuration = { features: { registration: true, registrationManagement: Boolean[false] } };
```


## Routes
You can change the [default routes](/lib/helpers/defaults.js#L45-L55) by providing a routes object
to the oidc-provider constructor.

```js
const oidc = new Provider('http://localhost:3000', {
  routes: {
    authorization: '/authz',
    certificates: '/jwks'
  }
});
```


## Keys (for asymmetric signatures and encryption)
oidc-provider expects a jose.JWK.KeyStore populated with your keys passed in with the configuration,
at the very least you must add a RS256 sig capable key, else your OP would be invalid. For
convenience the relevant node-jose methods are exposed next to the Provider - asKeyStore and createKeyStore.

```js
const { Provider, asKeyStore } = require('oidc-provider');
asKeyStore({
  keys: [
    { d: '..', dp: '..', dq: '..', e: '..', kty: 'RSA', n: '..', p: '..', q: '..', qi: '..' },
    { d: '..', dp: '..', dq: '..', e: '..', kty: 'RSA', n: '..', p: '..', q: '..', qi: '..' },
  ]
}).then(keystore => {
  new Provider('http://localhost:3000', { keystore });
});
```


## Persistance
The provided example and any new instance of oidc-provider will use the basic in-memory adapter for
storing issued tokens, codes and user sessions. This is fine for as long as you develop, configure
and generally just play around since every time you restart your process all information will be
lost. As soon as you cannot live with this limitation you will be required to provide an adapter
for oidc-provider to use.

```js
const MyAdapter = require('./my_adapter');
const oidc = new Provider('http://localhost:3000', {
  adapter: MyAdapter
});
```

The API oidc-provider expects is documented [here](/example/my_adapter.js). For reference see the
[memory adapter](/lib/adapters/memory_adapter.js) and [redis](/example/adapters/redis.js) of
[mongodb](/example/adapters/mongodb.js) adapters. There's also a simple test
[[redis](/example/adapters/redis_test.js),[mongodb](/example/adapters/mongodb_test.js)] you can use to
check your own implementation.


## Accounts
oidc-provider needs to be able to find an account and once found the account needs to have an
`accountId` property as well as `claims()` function returning an object with claims that correspond
to the claims your issuer supports. You can make oidc-provider lookup your accounts using your
method during initialization.

```js
const oidc = new Provider('http://localhost:3000', {
  findById: function (id) {
    return Promise.resolve({
      accountId: id,
      claims() { return { sub: id }; },
    });
  }
});
```

Note: the `findById` method needs to be yieldable, returning a Promise is recommended.  
Tip: check how the [example](/example/account.js) deals with this

**Aggregated and Distributed claims**  
Returning aggregated and distributed claims is as easy as having your Account#claims method return
the two necessary members `_claim_sources` and `_claim_names` with the
[expected][feature-aggregated-distributed-claims] properties. oidc-provider will include only the
sources for claims that are part of the request scope, omitting the ones that the RP did not request
and leaving out the entire `_claim_sources` and `_claim_sources` if they bear no requested claims.

Note: to make sure the RPs can expect these claims you should configure your discovery to return
the respective claim types via the `claim_types_supported` property.
```js
const oidc = new Provider('http://localhost:3000', {
  discovery: {
    claim_types_supported: ['normal', 'aggregated', 'distributed']
  }
});
```


## Interaction
Since oidc-provider comes with no views and interaction handlers what so ever it's up to you to fill
those in, here's how oidc-provider allows you to do so:

When oidc-provider cannot fulfill the authorization request for any of the possible reasons (missing
user session, requested ACR not fulfilled, prompt requested, ...) it will resolve an `interactionUrl`
(configured during initialization) and redirect the User-Agent to that url. Before doing so it will
create a signed `_grant` cookie that you can read from your interaction 'app'. This
cookie contains 1) details of the interaction that is required; 2) all authorization request
parameters and 3) the uuid of the authorization request and 4) the url to redirect the user to once
interaction is finished. oidc-provider expects that you resolve all future interactions in one go
and only then redirect the User-Agent back with the results.

Once all necessary interaction is finished you are expected to redirect back to the authorization
endpoint, affixed by the uuid of the original request and the interaction results dumped in a signed
`_grant_result` cookie. Please see the [example](/example/index.js), it's using a helper `resume` of
the provider instance that ties things together for you.


## Clients
TODO  
Clients can be managed programmatically or via out of bounds mechanisms using your provided Adapter.
At the very least you must provide client_id, client_secret and redirect_uris for each client. See
the rest of the available metadata [here][client-metadata].

Note: each oidc-provider caches the clients once they are loaded (via either of the mechanisms),
when in need of client configuration "reload" you can purge this cache like so
`oidc.Client.purge()`;

**via Provider interface**  
To add pre-established clients use the `addClient` method on a oidc-provider instance. This accepts
metadata object and returns a Promise, fulfilled with the added Client object, rejected with a
validation or other errors that may have been encountered.

```js
const oidc = new Provider('http://localhost:3000');
const metadata = {
  // ...
};
oidc.addClient(metadata).then(fulfillmentHandler, rejectionHandler);
```

**via Adapter**  
Storing client metadata in your storage is recommended for distributed deployments. Also when you
want to provide a client configuration GUI or plan on changing this data often. Clients get loaded
*! and validated !* when they are first needed, any metadata validation error encountered during
this first load will be thrown and handled like any other context specific errors.


## Custom Grant Types
oidc-provider comes with the basic grants implemented, but you can register your own grant types,
for example to implement a [password grant type][password-grant]. You can check the standard
grant factories [here](/lib/actions/token).

```js
const parameters = ['username', 'password'];

provider.registerGrantType('password', function passwordGrantTypeFactory(providerInstance) {
  return function * passwordGrantType(next) {
    if (this.oidc.params.username === 'foo' && this.oidc.params.password === 'bar') {
      const AccessToken = providerInstance.AccessToken;
      const at = new AccessToken({
        accountId: 'foo',
        clientId: this.oidc.client.clientId,
        grantId: this.oidc.uuid,
      });

      const accessToken = yield at.save();
      const tokenType = 'Bearer';
      const expiresIn = AccessToken.expiresIn;

      this.body = {
        access_token: accessToken,
        expires_in: expiresIn,
        token_type: tokenType,
      };
    } else {
      this.body = {
        error: 'invalid_grant',
        error_description: 'invalid credentials provided',
      };
      this.status = 400;
    }

    yield next;
  };
}, parameters);
```
Tip: you are able to modify the implemented grant type behavior like this.


## Custom Discovery Properties
You can extend the returned discovery properties beyond the defaults
```js
const oidc = new Provider('http://localhost:3000', {
  discovery: {
     service_documentation: 'http://server.example.com/connect/service_documentation.html',
     ui_locales_supported: ['en-US', 'en-GB', 'en-CA', 'fr-FR', 'fr-CA'],
     version: '3.1'
  }
});
```


## OAuth Token Integrity
To enable an extra layer of protection (against someone controlling your tokens via the storage
layer) you just need to pass a jose.JWK.KeyStore as `tokenIntegrity` configuration option.
The first token you push on to this key store will be used to cryptographically sign the oauth tokens
prohibiting any tampering with the payload and header content.


## Changing HTTP request defaults
Setting `defaultHttpOptions` on `Provider` instance merges your passed options with the defaults.
oidc-provider uses [got][got-library] for http requests with the following default request options

```js
const DEFAULT_HTTP_OPTIONS = {
  followRedirect: false,
  headers: { 'User-Agent': `${pkg.name}/${pkg.version} (${this.issuer}; ${pkg.homepage})` },
  retries: 0,
  timeout: 1500,
};
```

You can add your own headers, change the user-agent used or change the timeout setting
```js
provider.defaultHttpOptions = { timeout: 2500, headers: { 'X-Your-Header': '<whatever>' } };
```

Confirm your httpOptions by
```js
console.log('httpOptions %j', provider.defaultHttpOptions);
```

[client-metadata]: http://openid.net/specs/openid-connect-registration-1_0.html#ClientMetadata
[core-account-claims]: http://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims
[core-claims-url]: http://openid.net/specs/openid-connect-core-1_0.html#ClaimsParameter
[core-jwt-parameters-url]: http://openid.net/specs/openid-connect-core-1_0.html#JWTRequests
[feature-aggregated-distributed-claims]: http://openid.net/specs/openid-connect-core-1_0.html#AggregatedDistributedClaims
[feature-backchannel-logout]: http://openid.net/specs/openid-connect-backchannel-1_0-03.html
[feature-introspection]: https://tools.ietf.org/html/rfc7662
[feature-registration-management]: https://tools.ietf.org/html/rfc7592
[feature-registration]: http://openid.net/specs/openid-connect-registration-1_0.html
[feature-revocation]: https://tools.ietf.org/html/rfc7009
[feature-session-management]: http://openid.net/specs/openid-connect-session-1_0-27.html
[got-library]: https://github.com/sindresorhus/got
[password-grant]: https://tools.ietf.org/html/rfc6749#section-4.3
