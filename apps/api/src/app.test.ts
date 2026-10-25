import assert from 'node:assert/strict';
import test from 'node:test';
import request from 'supertest';
import { createApp } from './app.js';
import { readEnv } from './config/env.js';
import { isSupabaseServerKey } from './lib/supabase.js';

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

test('service pilot details fail closed without database configuration', async () => {
  const response = await request(app).get('/api/services').expect(503);
  assert.equal(response.body.error.code, 'DATABASE_UNAVAILABLE');
});

test('malformed JSON returns a safe client error', async () => {
  const response = await request(app).post('/api/bookings').set('Content-Type', 'application/json').send('{').expect(400);
  assert.equal(response.body.error.code, 'INVALID_JSON');
  assert.equal(JSON.stringify(response.body).includes('SyntaxError'), false);
});

test('mainnet configuration is rejected', () => {
  assert.throws(() => readEnv({ STELLAR_NETWORK: 'public' }), /Testnet/);
});

test('production listens on the container interface and preserves the supplied port', () => {
  const deployed = readEnv({ NODE_ENV: 'production', PORT: '10000' });
  assert.equal(deployed.host, '0.0.0.0');
  assert.equal(deployed.port, 10000);
  assert.equal(readEnv({}).host, '127.0.0.1');
  assert.equal(readEnv({ NODE_ENV: 'production', HOST: '127.0.0.1' }).host, '127.0.0.1');
});

test('Supabase admin client rejects publishable and legacy anon keys', () => {
  const jwt = (role: string) => `e30.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.signature`;
  assert.equal(isSupabaseServerKey('sb_publishable_demo_public_key'), false);
  assert.equal(isSupabaseServerKey(jwt('anon')), false);
  assert.equal(isSupabaseServerKey('sb_secret_demo_server_key'), true);
  assert.equal(isSupabaseServerKey(jwt('service_role')), true);
});

test('frontend origin configuration normalizes exact origins and rejects unsafe entries', () => {
  assert.deepEqual(readEnv({ WEB_ORIGIN: ' http://127.0.0.1:5174/, http://localhost:5174, http://localhost:5174/ ' }).webOrigins,
    ['http://127.0.0.1:5174', 'http://localhost:5174']);
  for (const origin of ['*', 'null', 'https://*.example.com', 'https://example.com/path', 'https://user:password@example.com', 'https://example.com?token=value', 'https://example.com#fragment', 'file:///tmp', 'https://example.com,']) {
    assert.throws(() => readEnv({ WEB_ORIGIN: origin }), /WEB_ORIGIN/);
  }
});

test('CORS accepts both explicitly configured local origins and rejects other sites', async () => {
  const local = createApp(readEnv({ WEB_ORIGIN: 'http://127.0.0.1:5174,http://localhost:5174' }));
  for (const origin of ['http://127.0.0.1:5174', 'http://localhost:5174']) {
    const response = await request(local).options('/api/payments/demo/prepare').set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,content-type').expect(204);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    assert.match(response.headers['access-control-allow-headers'], /authorization/);
  }
  for (const origin of ['https://untrusted.example', 'http://localhost.evil.test:5174', 'http://localhost:51740', 'null']) {
    const response = await request(local).get('/api/health').set('Origin', origin).expect(200);
    assert.equal(response.headers['access-control-allow-origin'], undefined);
  }
});

test('a deployed origin does not implicitly enable localhost', async () => {
  const deployed = createApp(readEnv({ NODE_ENV: 'production', WEB_ORIGIN: 'https://bayanihan.example/' }));
  const allowed = await request(deployed).get('/api/health').set('Origin', 'https://bayanihan.example').expect(200);
  assert.equal(allowed.headers['access-control-allow-origin'], 'https://bayanihan.example');
  const rejected = await request(deployed).get('/api/health').set('Origin', 'http://localhost:5174').expect(200);
  assert.equal(rejected.headers['access-control-allow-origin'], undefined);
});
