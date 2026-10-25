import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import { readEnv } from './config/env.js';

const app = createApp(readEnv({}));

test('health is available without external credentials', async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.equal(response.body.network, 'testnet');
});

test('booking and payment placeholders cannot be called anonymously', async () => {
  await request(app).get('/api/bookings').expect(401);
  await request(app).post('/api/bookings/123/payment/prepare').expect(401);
  await request(app).post('/api/bookings/123/payment/submit').expect(401);
});

test('missing auth configuration fails closed', async () => {
  await request(app).get('/api/bookings').set('Authorization', 'Bearer dummy').expect(503);
});

test('unfinished services endpoint does not return fabricated success', async () => {
  await request(app).get('/api/services').expect(501);
});

test('malformed JSON returns a safe client error', async () => {
  const response = await request(app).post('/api/bookings').set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
  assert.equal(JSON.stringify(response.body).includes('SyntaxError'), false);
});

test('mainnet configuration is rejected', () => {
  assert.throws(() => readEnv({ STELLAR_NETWORK: 'public' }), /Testnet/);
});
