'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, SUPABASE_CONFIGURED } from '@/lib/supabase';

export type AuthError = { message: string };

export interface UseAuthResult {
  /** True until the initial session fetch completes. */
  loading: boolean;
  /** The Supabase user, or null if anonymous. */
  user: User | null;
  session: Session | null;
  /** True if Supabase isn't configured — the app is anonymous-only. */
  disabled: boolean;
  signInWithGoogle: () => Promise<AuthError | null>;
  signInWithGitHub: () => Promise<AuthError | null>;
  signInWithPassword: (email: string, password: string) => Promise<AuthError | null>;
  signUpWithPassword: (email: string, password: string) => Promise<AuthError | null>;
  signOut: () => Promise<void>;
}

export function useAuth(): UseAuthResult {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    sb.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;

  const signInWithGoogle = useCallback(async (): Promise<AuthError | null> => {
    const sb = getSupabase();
    if (!sb) return { message: 'Auth is not configured' };
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    return error ? { message: error.message } : null;
  }, [redirectTo]);

  const signInWithGitHub = useCallback(async (): Promise<AuthError | null> => {
    const sb = getSupabase();
    if (!sb) return { message: 'Auth is not configured' };
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo },
    });
    return error ? { message: error.message } : null;
  }, [redirectTo]);

  const signInWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const sb = getSupabase();
      if (!sb) return { message: 'Auth is not configured' };
      const { error } = await sb.auth.signInWithPassword({ email, password });
      return error ? { message: error.message } : null;
    },
    [],
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string): Promise<AuthError | null> => {
      const sb = getSupabase();
      if (!sb) return { message: 'Auth is not configured' };
      const { error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      return error ? { message: error.message } : null;
    },
    [redirectTo],
  );

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
  }, []);

  return {
    loading,
    user: session?.user ?? null,
    session,
    disabled: !SUPABASE_CONFIGURED,
    signInWithGoogle,
    signInWithGitHub,
    signInWithPassword,
    signUpWithPassword,
    signOut,
  };
}
