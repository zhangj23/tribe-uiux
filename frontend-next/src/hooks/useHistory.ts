'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadHistory,
  addHistoryEntry,
  removeHistoryEntry,
  clearHistory,
  type HistoryEntry,
} from '@/lib/history';
import type { Job } from '@/types';

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(loadHistory());
    setReady(true);
  }, []);

  const record = useCallback((input: {
    job: Job;
    fileName: string;
    fileSize?: number;
  }) => {
    const entry = addHistoryEntry(input);
    setEntries(loadHistory());
    return entry;
  }, []);

  const remove = useCallback((id: string) => {
    removeHistoryEntry(id);
    setEntries(loadHistory());
  }, []);

  const clear = useCallback(() => {
    clearHistory();
    setEntries([]);
  }, []);

  return { entries, ready, record, remove, clear };
}
