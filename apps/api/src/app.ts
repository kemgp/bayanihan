import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { readEnv, type Config } from './config/env.js';
import { createSupabaseAdmin } from './lib/supabase.js';
import { createApiRouter } from './routes/index.js';
import { createPaymentRouter } from './modules/payments/routes.js';
import { PaymentError } from './modules/payments/model.js';

export function createApp(config: Config = readEnv()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.webOrigin }));
  app.use(express.json({ limit: '256kb' }));
  const supabase = createSupabaseAdmin(config);
  app.use('/api', createPaymentRouter(config, supabase));
  app.use('/api', createApiRouter(supabase));
  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
  });
  const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof PaymentError) {
      response.status(error.status).json({ error: { code: error.code, message: error.message } });
      return;
    }
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : 500;
    const clientError = status === 400 || status === 413;
    response.status(clientError ? status : 500).json({
      error: {
        code: status === 413 ? 'BODY_TOO_LARGE' : clientError ? 'INVALID_JSON' : 'INTERNAL_ERROR',
        message: clientError ? 'Invalid request body.' : 'An unexpected server error occurred.',
      },
    });
  };
  app.use(handleError);
  return app;
}
