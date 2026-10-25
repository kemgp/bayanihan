import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAuth } from '../middleware/auth.js';

const notImplemented: RequestHandler = (_request, response) => {
  response.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'This feature has not been implemented yet.' } });
};

export function createApiRouter(supabase: SupabaseClient | null) {
  const router = Router();
  router.get('/health', (_request, response) => {
    response.json({ status: 'ok', service: 'bayanihan-api', network: 'testnet' });
  });
  router.get('/services', notImplemented);
  const authenticated = requireAuth(supabase);
  router.get('/bookings', authenticated, notImplemented);
  router.post('/bookings', authenticated, notImplemented);
  router.patch('/bookings/:id/status', authenticated, notImplemented);
  router.post('/bookings/:id/payment/prepare', authenticated, notImplemented);
  router.post('/bookings/:id/payment/submit', authenticated, notImplemented);
  router.get('/bookings/:id/payment', authenticated, notImplemented);
  return router;
}
