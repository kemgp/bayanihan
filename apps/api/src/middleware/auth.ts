import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

export function requireAuth(client: SupabaseClient | null): RequestHandler {
  return async (request, response, next) => {
    const match = /^Bearer (\S+)$/i.exec(request.headers.authorization ?? '');
    if (!match?.[1]) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'A bearer token is required.' } });
      return;
    }
    if (!client) {
      response.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Configure a Supabase server secret key in the API environment, then restart the API.' } });
      return;
    }
    const { data, error } = await client.auth.getUser(match[1]);
    if (error || !data.user) {
      response.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'The session is invalid or expired.' } });
      return;
    }
    response.locals.user = data.user;
    next();
  };
}
