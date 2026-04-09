import type { Job } from '@/types';

const STORAGE_KEY = 'tribe.history.v1';
const MAX_ENTRIES = 12;

export interface HistoryEntry {
  id: string;
  savedAt: number;
  fileName: string;
  fileType: 'image' | 'video' | 'audio' | 'other';
  fileSize: number;
  /** Optional user-provided label (e.g. "Landing hero v3 — higher contrast"). */
  label?: string;
  /** Pinned entries float to the top and are never evicted by the LRU cap. */
  pinned?: boolean;
  /** Slim snapshot of the job. `brain_activations` is intentionally dropped to stay within localStorage quota. */
  job: Omit<Job, 'brain_activations'>;
}

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function inferFileType(name: string, mime?: string): HistoryEntry['fileType'] {
  if (mime?.startsWith('image/')) return 'image';
  if (mime?.startsWith('video/')) return 'video';
  if (mime?.startsWith('audio/')) return 'audio';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) return 'image';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) return 'audio';
  return 'other';
}

export function loadHistory(): HistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(e => e && typeof e.id === 'string');
  } catch {
    return [];
  }
}

function saveAll(entries: HistoryEntry[]) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota exceeded — drop the oldest half and retry once
    const half = entries.slice(0, Math.max(1, Math.floor(entries.length / 2)));
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(half));
    } catch {
      // Give up silently — history is a best-effort cache.
    }
  }
}

export function addHistoryEntry(input: {
  job: Job;
  fileName: string;
  fileType?: HistoryEntry['fileType'];
  fileSize?: number;
}): HistoryEntry {
  const { job, fileName, fileType, fileSize } = input;
  // Strip the big payload from what we persist.
  const slim: Omit<Job, 'brain_activations'> = { ...job };
  delete (slim as Partial<Job>).brain_activations;

  const entry: HistoryEntry = {
    id: job.job_id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    fileName,
    fileType: fileType ?? inferFileType(fileName),
    fileSize: fileSize ?? 0,
    job: slim,
  };

  const current = loadHistory().filter(e => e.id !== entry.id);
  // Trim while preserving every pinned entry. New entry slots in at the top
  // (after pinned entries are pulled forward by the sort that HistoryPanel
  // applies on render). If we'd overflow, drop the oldest *unpinned* entry.
  const combined = [entry, ...current];
  let trimmed = combined;
  while (trimmed.length > MAX_ENTRIES) {
    const oldestUnpinnedIdx = (() => {
      let idx = -1;
      let oldest = Infinity;
      for (let i = 0; i < trimmed.length; i++) {
        const e = trimmed[i];
        if (e.pinned) continue;
        if (e.savedAt < oldest) { oldest = e.savedAt; idx = i; }
      }
      return idx;
    })();
    if (oldestUnpinnedIdx < 0) break; // every entry is pinned — give up
    trimmed = trimmed.filter((_, i) => i !== oldestUnpinnedIdx);
  }
  saveAll(trimmed);
  return entry;
}

export function togglePinHistoryEntry(id: string): HistoryEntry | null {
  const entries = loadHistory();
  let updated: HistoryEntry | null = null;
  const next = entries.map(e => {
    if (e.id !== id) return e;
    updated = { ...e, pinned: !e.pinned };
    return updated;
  });
  saveAll(next);
  return updated;
}

export function removeHistoryEntry(id: string) {
  const next = loadHistory().filter(e => e.id !== id);
  saveAll(next);
}

export function renameHistoryEntry(id: string, label: string): HistoryEntry | null {
  const entries = loadHistory();
  let updated: HistoryEntry | null = null;
  const next = entries.map(e => {
    if (e.id !== id) return e;
    const trimmed = label.trim();
    updated = { ...e, label: trimmed || undefined };
    return updated;
  });
  saveAll(next);
  return updated;
}

export function clearHistory() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}
