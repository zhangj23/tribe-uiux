'use client';

import { useState, FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Mode = 'signin' | 'signup';

interface Props {
  /** Optional "continue without signing in" escape hatch, shown only when
   *  the parent renders this as a gate (not a forced wall). */
  onContinueAnonymous?: () => void;
}

export default function LoginView({ onContinueAnonymous }: Props) {
  const {
    signInWithGoogle,
    signInWithGitHub,
    signInWithPassword,
    signUpWithPassword,
  } = useAuth();

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const runOAuth = async (provider: 'google' | 'github') => {
    setBusy(true);
    setError(null);
    setInfo(null);
    const err =
      provider === 'google' ? await signInWithGoogle() : await signInWithGitHub();
    if (err) {
      setError(err.message);
      setBusy(false);
    }
    // If successful, Supabase will redirect; we stay busy until the redirect
    // finishes and the auth state change flips user away from this screen.
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const err =
      mode === 'signin'
        ? await signInWithPassword(email, password)
        : await signUpWithPassword(email, password);
    if (err) {
      setError(err.message);
    } else if (mode === 'signup') {
      setInfo(
        "Check your inbox for a confirmation email. (If you disabled email confirmation in Supabase, you're already signed in.)",
      );
    }
    setBusy(false);
  };

  return (
    <div className="login-view view-enter">
      <div className="login-card">
        <div className="login-hero">
          <h2 className="login-title">
            <span className="title-line">Sign in to</span>
            <span className="title-line">
              <em>TRIBE</em> UX
            </span>
          </h2>
          <p className="login-desc">
            Save your analyses, organize runs into projects, and rank versions
            by friction score.
          </p>
        </div>

        <div className="login-oauth">
          <button
            type="button"
            className="login-oauth-btn login-oauth-btn--google"
            onClick={() => runOAuth('google')}
            disabled={busy}
          >
            <span className="login-oauth-icon" aria-hidden>
              G
            </span>
            Continue with Google
          </button>
          <button
            type="button"
            className="login-oauth-btn login-oauth-btn--github"
            onClick={() => runOAuth('github')}
            disabled={busy}
          >
            <span className="login-oauth-icon" aria-hidden>
              ⌘
            </span>
            Continue with GitHub
          </button>
        </div>

        <div className="login-divider">
          <span>or with email</span>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label className="login-field">
            <span className="login-field-label">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="login-field">
            <span className="login-field-label">Password</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={busy}
            />
          </label>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}
          {info && (
            <div className="login-info" role="status">
              {info}
            </div>
          )}

          <button type="submit" className="login-submit" disabled={busy}>
            {busy
              ? 'Working…'
              : mode === 'signin'
              ? 'Sign in'
              : 'Create account'}
          </button>

          <button
            type="button"
            className="login-toggle"
            onClick={() => {
              setMode(prev => (prev === 'signin' ? 'signup' : 'signin'));
              setError(null);
              setInfo(null);
            }}
          >
            {mode === 'signin'
              ? "Don't have an account? Sign up →"
              : 'Have an account? Sign in →'}
          </button>
        </form>

        {onContinueAnonymous && (
          <button
            type="button"
            className="login-anon"
            onClick={onContinueAnonymous}
          >
            Continue without signing in
          </button>
        )}
      </div>
    </div>
  );
}
