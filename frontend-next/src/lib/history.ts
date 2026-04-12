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
  /** Optional freeform user note (markdown-ish, but rendered as plain text). */
  note?: string;
  /** Pinned entries float to the top and are never evicted by the LRU cap. */
  pinned?: boolean;
  /** How long the upload → completed pipeline took, in milliseconds. */
  durationMs?: number;
  /** Slim snapshot of the job. `brain_activations` is intentionally dropped to stay within localStorage quota. */
  job: Omit<Job, 'brain_activations'>;
  /** Server-side uuid for this run when the user is signed in. Used to key PATCH/DELETE. */
  serverRunId?: string;
  /** Project this run is filed under on the server (null = "Unfiled"). */
  projectId?: string | null;
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
  durationMs?: number;
}): HistoryEntry {
  const { job, fileName, fileType, fileSize, durationMs } = input;
  // Strip the big payload from what we persist.
  const slim: Omit<Job, 'brain_activations'> = { ...job };
  delete (slim as Partial<Job>).brain_activations;

  const entry: HistoryEntry = {
    id: job.job_id || `hist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    fileName,
    fileType: fileType ?? inferFileType(fileName),
    fileSize: fileSize ?? 0,
    durationMs: durationMs && durationMs > 0 ? durationMs : undefined,
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

export function removeHistoryEntries(ids: string[]) {
  if (ids.length === 0) return;
  const drop = new Set(ids);
  const next = loadHistory().filter(e => !drop.has(e.id));
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

export function setHistoryNote(id: string, note: string): HistoryEntry | null {
  const entries = loadHistory();
  let updated: HistoryEntry | null = null;
  const next = entries.map(e => {
    if (e.id !== id) return e;
    const trimmed = note.trim();
    updated = { ...e, note: trimmed || undefined };
    return updated;
  });
  saveAll(next);
  return updated;
}

/** Patch the server-side linkage on a local entry (used after a mirror POST). */
export function setHistoryServerLink(
  id: string,
  patch: { serverRunId?: string; projectId?: string | null },
): HistoryEntry | null {
  const entries = loadHistory();
  let updated: HistoryEntry | null = null;
  const next = entries.map(e => {
    if (e.id !== id) return e;
    updated = {
      ...e,
      serverRunId: patch.serverRunId ?? e.serverRunId,
      projectId: patch.projectId !== undefined ? patch.projectId : e.projectId,
    };
    return updated;
  });
  saveAll(next);
  return updated;
}

/** Merge server-fetched runs into local history. Keyed by job_id. Server
 *  values win on conflict, which keeps the local cache eventually consistent
 *  with the authoritative copy. */
export function mergeServerEntries(
  serverEntries: HistoryEntry[],
): HistoryEntry[] {
  const local = loadHistory();
  const byJobId = new Map(local.map(e => [e.job.job_id || e.id, e]));
  for (const s of serverEntries) {
    const key = s.job.job_id || s.id;
    const existing = byJobId.get(key);
    if (existing) {
      byJobId.set(key, {
        ...existing,
        // Preserve pinned state from whichever side is more recent.
        ...s,
        pinned: s.pinned ?? existing.pinned,
      });
    } else {
      byJobId.set(key, s);
    }
  }
  const merged = Array.from(byJobId.values());
  merged.sort((a, b) => {
    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return b.savedAt - a.savedAt;
  });
  // Trim unpinned if needed.
  let trimmed = merged;
  while (trimmed.length > MAX_ENTRIES) {
    const idx = (() => {
      let found = -1;
      let oldest = Infinity;
      for (let i = 0; i < trimmed.length; i++) {
        const e = trimmed[i];
        if (e.pinned) continue;
        if (e.savedAt < oldest) { oldest = e.savedAt; found = i; }
      }
      return found;
    })();
    if (idx < 0) break;
    trimmed = trimmed.filter((_, i) => i !== idx);
  }
  saveAll(trimmed);
  return trimmed;
}

export function clearHistory() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

interface HistoryBackup {
  version: 1;
  exportedAt: number;
  entries: HistoryEntry[];
}

export function exportHistoryAsBackup(): string {
  const backup: HistoryBackup = {
    version: 1,
    exportedAt: Date.now(),
    entries: loadHistory(),
  };
  return JSON.stringify(backup, null, 2);
}

export interface ImportResult {
  ok: boolean;
  imported: number;
  reason?: string;
}

/**
 * Merge an exported backup into the current history. New entries (by id)
 * are added; existing entries are left alone so a restore never silently
 * overwrites a fresher version. Returns how many entries were merged.
 */
export function importHistoryFromBackup(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, imported: 0, reason: 'File is not valid JSON.' };
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    (parsed as HistoryBackup).version !== 1 ||
    !Array.isArray((parsed as HistoryBackup).entries)
  ) {
    return { ok: false, imported: 0, reason: 'Backup file format not recognised.' };
  }

  const incoming = (parsed as HistoryBackup).entries.filter(
    e => e && typeof e.id === 'string' && e.job
  );
  const existing = loadHistory();
  const seen = new Set(existing.map(e => e.id));
  const merged = [...existing];
  let added = 0;
  for (const e of incoming) {
    if (seen.has(e.id)) continue;
    merged.push(e);
    seen.add(e.id);
    added++;
  }
  // Resort by savedAt desc but keep pinned first; trim if we overflow.
  merged.sort((a, b) => {
    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return b.savedAt - a.savedAt;
  });
  let trimmed = merged;
  while (trimmed.length > MAX_ENTRIES) {
    const oldestUnpinnedIdx = (() => {
      let idx = -1;
      let oldest = Infinity;
      for (let i = 0; i < trimmed.length; i++) {
        const entry = trimmed[i];
        if (entry.pinned) continue;
        if (entry.savedAt < oldest) { oldest = entry.savedAt; idx = i; }
      }
      return idx;
    })();
    if (oldestUnpinnedIdx < 0) break;
    trimmed = trimmed.filter((_, i) => i !== oldestUnpinnedIdx);
  }
  saveAll(trimmed);
  return { ok: true, imported: added };
}
