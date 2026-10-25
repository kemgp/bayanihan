import { createClient } from '@supabase/supabase-js';
import type { Config } from '../config/env.js';

export function isSupabaseServerKey(key: string) {
  if (key.startsWith('sb_secret_') && key.length > 16) return true;
  try {
    const payload = key.split('.')[1];
    return key.split('.').length === 3 && payload !== undefined && JSON.parse(Buffer.from(payload, 'base64url').toString()).role === 'service_role';
  } catch { return false; }
}

export function createSupabaseAdmin(config: Config) {
  if (!config.supabaseUrl || !isSupabaseServerKey(config.supabaseSecretKey)) return null;
  return createClient(config.supabaseUrl, config.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
