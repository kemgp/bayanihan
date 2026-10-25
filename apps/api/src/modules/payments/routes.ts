import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Config } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { PaymentError, PLATFORM, TOTAL, WORKER, publicPayment } from './model.js';
import { createPaymentGateway } from './gateway.js';
import { createPaymentStore } from './store.js';
import { createPaymentService, type PaymentService } from './service.js';

export function createPaymentRouter(config: Config, db: SupabaseClient | null, injected?: PaymentService) {
  const router = Router();
  const gateway = createPaymentGateway(config);
  const service = injected ?? (db ? createPaymentService(createPaymentStore(db), gateway, config.paiflowDeploymentId) : null);
  // Public configuration exposes public addresses and readiness only, never deployment credentials.
  router.get('/payments/config', async (_req, res) => {
    try {
      const split = await (injected?.configuration() ?? gateway.configuration());
      res.json({ ready: true, network: 'testnet', total: TOTAL, workerAmount: WORKER, platformAmount: PLATFORM, split });
    } catch {
      res.json({ ready: false, network: 'testnet', total: TOTAL, workerAmount: WORKER, platformAmount: PLATFORM, message: 'Paiflow Testnet configuration is unavailable. Check the server configuration and splitter.' });
    }
  });
  router.use(['/me', '/payments/demo'], requireAuth(db));
  router.use(['/me', '/payments/demo'], async (_req, res, next) => {
    if (!db) throw new PaymentError(503, 'AUTH_NOT_CONFIGURED', 'Authentication is not configured.');
    const { data, error } = await db.from('profiles').select('id,display_name,role').eq('id', res.locals.user.id).maybeSingle();
    if (error) throw new PaymentError(503, 'PROFILE_UNAVAILABLE', 'Could not load the protected account profile.');
    if (!data) throw new PaymentError(403, 'PROFILE_MISSING', 'Set up the demo account profile first.');
    res.locals.profile = data;
    next();
  });
  router.get('/me', (_req, res) => { res.json({ profile: res.locals.profile }); });
  const limits = new Map<string, { until: number; count: number }>();
  router.use('/payments/demo', (req, res, next) => {
    if (!service) throw new PaymentError(503, 'PAYMENT_STORAGE_UNAVAILABLE', 'Payment storage is not configured.');
    if (res.locals.profile.role !== 'customer') throw new PaymentError(403, 'CUSTOMER_REQUIRED', 'Sign in with the customer demo account to pay.');
    const now = Date.now();
    for (const [key, value] of limits) if (value.until <= now) limits.delete(key);
    const key = res.locals.user.id as string;
    const limit = limits.get(key) ?? { until: now + 60000, count: 0 };
    if (++limit.count > 40) throw new PaymentError(429, 'RATE_LIMITED', 'Too many payment requests. Wait a minute and check the saved payment.');
    limits.set(key, limit);
    if (req.method !== 'GET' && req.headers.origin && req.headers.origin !== config.webOrigin) throw new PaymentError(403, 'ORIGIN_REJECTED', 'Use the configured BAYANIHAN website.');
    res.set('Cache-Control', 'no-store');
    next();
  });
  router.get('/payments/demo', async (_req, res) => { res.json({ payment: publicPayment(await service!.current(res.locals.user.id)) }); });
  router.post('/payments/demo/prepare', async (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => key !== 'payer')) throw new PaymentError(400, 'INVALID_INPUT', 'Only the connected payer address may be supplied.');
    res.json({ payment: publicPayment(await service!.prepare(res.locals.user.id, req.body.payer)) });
  });
  router.post('/payments/demo/:id/submit', async (req, res) => {
    if (!req.body || Object.keys(req.body).some(key => key !== 'signedXdr')) throw new PaymentError(400, 'INVALID_INPUT', 'Submit only the signed original transaction.');
    res.json({ payment: publicPayment(await service!.submit(res.locals.user.id, String(req.params.id), req.body.signedXdr)) });
  });
  router.post('/payments/demo/:id/check', async (req, res) => { res.json({ payment: publicPayment(await service!.check(res.locals.user.id, String(req.params.id))) }); });
  router.post('/payments/demo/:id/retry', async (req, res) => { res.json({ payment: publicPayment(await service!.retryOriginal(res.locals.user.id, String(req.params.id))) }); });
  router.post('/payments/demo/:id/new', async (req, res) => {
    await service!.newDemo(res.locals.user.id, String(req.params.id));
    res.json({ payment: null });
  });
  return router;
}
