import { createClient } from '@supabase/supabase-js';
import type { Config } from '../config/env.js';

export function createSupabaseAdmin(config: Config) {
  if (!config.supabaseUrl || !config.supabaseSecretKey) return null;
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
