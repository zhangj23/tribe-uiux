'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

/** True when Supabase env vars are present. If false, the app runs in
 * anonymous-only mode and never shows the login UI. */
export const SUPABASE_CONFIGURED = !!SUPABASE_URL && !!SUPABASE_ANON_KEY;

/** When NEXT_PUBLIC_AUTH_REQUIRED is "true", we gate the app behind the
 * login screen. Otherwise the login lives in the header menu and anonymous
 * usage still works. */
export const AUTH_REQUIRED =
  (process.env.NEXT_PUBLIC_AUTH_REQUIRED ?? 'false').toLowerCase() === 'true';

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!SUPABASE_CONFIGURED) return null;
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return _client;
}
