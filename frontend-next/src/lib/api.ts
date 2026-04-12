'use client';

import { getSupabase, SUPABASE_CONFIGURED } from './supabase';

export interface ApiFetchOptions extends RequestInit {
  /** If true, don't attach an Authorization header even when signed in. */
  anonymous?: boolean;
}

async function currentAccessToken(): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

async function refreshToken(): Promise<string | null> {
  if (!SUPABASE_CONFIGURED) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

/**
 * fetch() wrapper that transparently:
 *   1. Attaches `Authorization: Bearer <access_token>` when signed in.
 *   2. On a 401, attempts one refresh + retry before giving up.
 *
 * All of the app's /api calls should go through this so anonymous and
 * authenticated flows share one code path.
 */
export async function apiFetch(
  path: string,
  init: ApiFetchOptions = {},
): Promise<Response> {
  const { anonymous, headers, ...rest } = init;

  const attach = async (token: string | null): Promise<Response> => {
    const h = new Headers(headers || {});
    if (token && !anonymous) {
      h.set('Authorization', `Bearer ${token}`);
    }
    return fetch(path, { ...rest, headers: h });
  };

  const token = anonymous ? null : await currentAccessToken();
  let resp = await attach(token);

  if (resp.status === 401 && !anonymous && SUPABASE_CONFIGURED) {
    const fresh = await refreshToken();
    if (fresh) {
      resp = await attach(fresh);
    }
  }

  return resp;
}

/** Convenience: fetch + parse JSON, throwing on non-2xx. */
export async function apiJson<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const resp = await apiFetch(path, init);
  if (!resp.ok) {
    let detail: string | undefined;
    try {
      const body = await resp.json();
      detail = body?.detail ?? body?.message;
    } catch {
      // ignore
    }
    throw new Error(detail || `Request failed: ${resp.status}`);
  }
  return (await resp.json()) as T;
}
