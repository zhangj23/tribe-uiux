'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import type { HealthResponse } from '@/types';

export type HealthStatus =
  | { state: 'loading' }
  | { state: 'ok'; data: HealthResponse }
  | { state: 'offline' };

export function useHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Health check is safe to call anonymously — don't force an Auth header
    // for users who aren't signed in yet.
    apiFetch('/api/health', { signal: controller.signal, anonymous: true })
      .then(r => {
        if (!r.ok) throw new Error('health check failed');
        return r.json();
      })
      .then((data: HealthResponse) => {
        if (!cancelled) setStatus({ state: 'ok', data });
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: 'offline' });
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  return status;
}
