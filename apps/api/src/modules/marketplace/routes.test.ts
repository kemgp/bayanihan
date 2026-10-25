import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import request from 'supertest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMarketplaceRouter } from './routes.js';

test('service catalogue returns all eight categories and keeps Carpenter unavailable without a seeded pilot', async () => {
  const query = {
    select() { return this; },
    eq() { return this; },
    ilike() { return this; },
    async maybeSingle() { return { data: null, error: null }; },
  };
  const db = { from: (table: string) => {
    assert.equal(table, 'services');
    return query;
  } } as unknown as SupabaseClient;
  const app = express().use(createMarketplaceRouter(db));
  const response = await request(app).get('/services').expect(200);

  assert.equal(response.body.services.length, 8);
  assert.deepEqual(response.body.services.map((service: { key: string }) => service.key), [
    'plumbing', 'electrician', 'carpenter', 'appliances', 'cleaner', 'painter', 'gardener', 'hvac',
  ]);
  const carpenter = response.body.services.find((service: { key: string }) => service.key === 'carpenter');
  assert.equal(carpenter.status, 'pilot');
  assert.equal(carpenter.available, false);
  assert.equal(carpenter.id, undefined);
});
