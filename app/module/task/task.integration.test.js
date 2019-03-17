'use strict';

/* eslint-env jest */

const { setupWithRunningApp } = require('@/test/setup');
const { getAuthenticatedUserByEmail, testUnauthenticatedFetch } = require('@/test/utils');

const CONST = require('@/common/const');

const CONFIG = require('@/common/config');

// const Logger = require('@/common/logger').createLogger($filepath(__filename));

describe('Task integration test', () => {
  describe('/task', () => {
    setupWithRunningApp('seed');

    const DATA = {};

    DATA.CLIENT = {
      email: 'client@starter.emiketic.com',
    };

    DATA.CREATE_RECORD = {
      title: 'Test Record',
      image_uri: '...',
    };

    const CACHE = {};

    beforeAll(async () => {
      CACHE.client = await getAuthenticatedUserByEmail(DATA.CLIENT.email, CONST.ROLE.CLIENT);
    });

    testUnauthenticatedFetch('GET /task should fail with unauthenticated access', () => fetch(`${CONFIG.API_ENDPOINT}/task'`));

    test('GET /task', async () => {
      const response = await fetch(`${CONFIG.API_ENDPOINT}/task`, {
        headers: {
          Authorization: `Bearer ${CACHE.client.access_token}`,
        },
      });
      expect(response.ok).toBe(true);
      const result = await response.json();
      expect(result.data.length).toBe(2);
    });
  });
});
