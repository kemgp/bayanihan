import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Importing the starter works before a Supabase project has been configured.
export const supabase = url && key ? createClient(url, key) : null;
