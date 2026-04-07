'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Job } from '@/types';

export function usePolling(
  jobId: string | null,
  onComplete: (data: Job) => void,
) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<string>('');
  const consecutiveErrors = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!jobId) return;

    setProgress(0);
    setStage('');
    consecutiveErrors.current = 0;

    const poll = async () => {
      try {
        const resp = await fetch(`/api/jobs/${jobId}`);
        if (!resp.ok) throw new Error('Request failed');
        const data: Job = await resp.json();
        consecutiveErrors.current = 0;

        setProgress(data.progress);
        setStage(data.status);

        if (data.status === 'completed') {
          stop();
          onCompleteRef.current(data);
        } else if (data.status === 'failed') {
          stop();
        }
      } catch {
        consecutiveErrors.current++;
        if (consecutiveErrors.current >= 10) stop();
      }
    };

    poll();
    intervalRef.current = setInterval(poll, 2000);

    return stop;
  }, [jobId, stop]);

  return { progress, stage, stop };
}
