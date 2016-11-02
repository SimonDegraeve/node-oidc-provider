'use strict';

/* eslint-disable no-underscore-dangle */

const { v4: uuid } = require('uuid');
const bootstrap = require('../test_helper');

const expire = new Date();
expire.setDate(expire.getDate() + 1);

const j = JSON.stringify;
const { expect } = require('chai');

describe('resume after interaction', function () {
  before(bootstrap(__dirname)); // this.provider, agent, getSession, this.AuthorizationRequest,

  before(function () {
    i(this.provider).configuration('prompts').push('custom');
  });

  function setup(agent, grant, results) {
    const cookies = [];

    if (grant) {
      cookies.push(`_grant=${j(grant)}; path=/; expires=${expire.toGMTString()}; httponly`);
    }

    if (results) {
      cookies.push(`_grant_result=${j(results)}; path=/; expires=${expire.toGMTString()}; httponly`);
    }

    agent._saveCookies.bind(agent)({
      headers: {
        'set-cookie': cookies
      },
    });
  }

  context('general', function () {
    it('needs the results to be present, else renders an err', function () {
      return this.agent.get(`/auth/${uuid()}`)
        .expect(400)
        .expect(/authorization request has expired/);
    });
  });

  context('login results', function () {
    it('should redirect to client with error if interaction did not resolve in a session', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        scope: 'openid'
      });

      setup(this.agent, auth);

      return this.agent.get(`/auth/${uuid()}`)
        .expect(302)
        .expect(auth.validateState)
        .expect(auth.validateClientLocation)
        .expect(auth.validateError('login_required'))
        .expect(auth.validateErrorDescription('End-User authentication is required'));
    });

    it('should process newly established permanent sessions', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        scope: 'openid'
      });

      setup(this.agent, auth, {
        login: {
          account: uuid(),
          remember: true
        }
      });

      return this.agent.get(`/auth/${uuid()}`)
        .expect(302)
        .expect('set-cookie', /expires/) // expect a permanent cookie
        .expect(auth.validateState)
        .expect(auth.validateClientLocation)
        .expect(auth.validatePresence(['code', 'state']))
        .expect(() => {
          expect(this.getSession()).to.be.ok.and.not.have.property('transient');
        });
    });

    it('should process newly established temporary sessions', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        scope: 'openid'
      });

      setup(this.agent, auth, {
        login: {
          account: uuid()
        }
      });

      return this.agent.get(`/auth/${uuid()}`)
        .expect(302)
        .expect(auth.validateState)
        .expect('set-cookie', /^_session=((?!expires).)+,/) // expect a transient session cookie
        .expect(auth.validateClientLocation)
        .expect(auth.validatePresence(['code', 'state']))
        .expect(() => {
          expect(this.getSession()).to.be.ok.and.have.property('transient');
        });
    });
  });

  context('consent results', function () {
    it('when scope includes offline_access', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        prompt: 'consent',
        scope: 'openid offline_access'
      });

      setup(this.agent, auth, {
        login: {
          account: uuid(),
          remember: true
        },
        consent: {}
      });

      let authorizationCode;

      this.provider.once('token.issued', (code) => {
        authorizationCode = code;
      });

      return this.agent.get(`/auth/${uuid()}`)
        .expect(() => {
          this.provider.removeAllListeners('token.issued');
        })
        .expect(() => {
          expect(authorizationCode).to.be.ok;
          expect(authorizationCode).to.have.property('scope', 'openid offline_access');
        });
    });

    it('should use the consents from resume cookie if provided', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        scope: 'openid'
      });

      setup(this.agent, auth, {
        login: {
          account: uuid(),
          remember: true
        },
        consent: {
          scope: 'openid profile'
        }
      });

      let authorizationCode;

      this.provider.once('token.issued', (code) => {
        authorizationCode = code;
      });

      return this.agent.get(`/auth/${uuid()}`)
        .expect(() => {
          this.provider.removeAllListeners('token.issued');
        })
        .expect(() => {
          expect(authorizationCode).to.be.ok;
          expect(authorizationCode).to.have.property('scope', 'openid profile');
        });
    });

    it('if not resolved returns consent_required error', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        scope: 'openid',
        prompt: 'consent'
      });

      setup(this.agent, auth, {
        login: {
          account: uuid(),
          remember: true
        }
      });

      return this.agent.get(`/auth/${uuid()}`)
        .expect(302)
        .expect(auth.validateState)
        .expect(auth.validateClientLocation)
        .expect(auth.validateError('consent_required'))
        .expect(auth.validateErrorDescription('prompt consent was not resolved'));
    });
  });

  context('custom prompts', function () {
    before(function () { return this.login(); });
    after(function () { return this.logout(); });

    it('should fail if they are not resolved', function () {
      const auth = new this.AuthorizationRequest({
        response_type: 'code',
        scope: 'openid',
        prompt: 'custom'
      });

      setup(this.agent, auth);

      return this.agent.get(`/auth/${uuid()}`)
        .expect(302)
        .expect(auth.validateState)
        .expect(auth.validateClientLocation)
        .expect(auth.validateError('interaction_required'))
        .expect(auth.validateErrorDescription('prompt custom was not resolved'));
    });
  });
});
