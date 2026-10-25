import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { PaiflowApiError, PaiflowTimeoutError } from '@paiflow/sdk';
import { readEnv } from '../../config/env.js';
import { createApp } from '../../app.js';
import { createPaymentGateway } from './gateway.js';
import { paiflowOrigin, readinessFailure } from './readiness.js';

const settings = {
  PAIFLOW_BASE_URL: 'https://beta.app.paiflow.xyz',
  PAIFLOW_API_TOKEN: `pfk_${'a'.repeat(64)}`,
  PAIFLOW_DEPLOYMENT_ID: '11111111-2222-4333-8444-555555555555',
};

test('readiness names missing and malformed settings before any network request', async () => {
  for (const [patch, code] of [
    [{ PAIFLOW_API_TOKEN: '' }, 'PAIFLOW_TOKEN_MISSING'],
    [{ PAIFLOW_API_TOKEN: '"secret-value"' }, 'PAIFLOW_TOKEN_INVALID'],
    [{ PAIFLOW_DEPLOYMENT_ID: '' }, 'PAIFLOW_DEPLOYMENT_MISSING'],
    [{ PAIFLOW_DEPLOYMENT_ID: 'contract-address' }, 'PAIFLOW_DEPLOYMENT_INVALID'],
    [{ PAIFLOW_BASE_URL: 'https://beta.app.paiflow.xyz/api' }, 'PAIFLOW_URL_INVALID'],
    [{ PAIFLOW_BASE_URL: 'invalid-url' }, 'PAIFLOW_URL_INVALID'],
  ] as const) {
    const config = readEnv({ ...settings, ...patch });
    await assert.rejects(createPaymentGateway(config).configuration(), { code });
  }
  assert.equal(paiflowOrigin(readEnv(settings)), settings.PAIFLOW_BASE_URL);
  assert.equal(paiflowOrigin(readEnv({ ...settings, PAIFLOW_API_TOKEN: `pfd_${'b'.repeat(64)}` })), settings.PAIFLOW_BASE_URL);
});

test('upstream readiness failures use fixed messages without credentials or upstream payloads', () => {
  const secret = 'sensitive-upstream-response';
  for (const status of [401, 403, 404, 500]) {
    const upstream = new PaiflowApiError(status, secret, secret, { secret }, { secret }, { status });
    const error = readinessFailure(upstream, 'paiflow');
    assert.equal(error.code, status === 404 ? 'PAIFLOW_DEPLOYMENT_NOT_FOUND' : status === 500 ? 'PAIFLOW_UNAVAILABLE' : 'PAIFLOW_ACCESS_DENIED');
    assert.equal(JSON.stringify(error).includes(secret), false);
    assert.equal(error.message.includes(secret), false);
  }
  assert.equal(readinessFailure(new PaiflowTimeoutError(), 'paiflow').code, 'PAIFLOW_TIMEOUT');
  assert.equal(readinessFailure(new Error(secret), 'stellar').code, 'STELLAR_RPC_UNAVAILABLE');
  assert.equal(readinessFailure(new Error(secret), 'splitter').code, 'SPLITTER_NOT_READY');
});

test('public readiness reports invalid configuration with CORS and no secret values', async () => {
  const config = readEnv({ ...settings, PAIFLOW_API_TOKEN: 'private-invalid-token', WEB_ORIGIN: 'https://bayanihan-six.vercel.app' });
  const response = await request(createApp(config)).get('/api/payments/config').set('Origin', 'https://bayanihan-six.vercel.app').expect(200);
  assert.equal(response.headers['access-control-allow-origin'], 'https://bayanihan-six.vercel.app');
  assert.equal(response.body.ready, false);
  assert.equal(response.body.code, 'PAIFLOW_TOKEN_INVALID');
  assert.equal(JSON.stringify(response.body).includes('private-invalid-token'), false);
  assert.equal(JSON.stringify(response.body).includes(settings.PAIFLOW_DEPLOYMENT_ID), false);
});
