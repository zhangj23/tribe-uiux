'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadHistory,
  addHistoryEntry,
  removeHistoryEntry,
  removeHistoryEntries,
  renameHistoryEntry,
  togglePinHistoryEntry,
  setHistoryNote,
  setHistoryServerLink,
  mergeServerEntries,
  exportHistoryAsBackup,
  importHistoryFromBackup,
  clearHistory,
  type HistoryEntry,
  type ImportResult,
} from '@/lib/history';
import {
  createRun,
  deleteRun as apiDeleteRun,
  listRuns,
  patchRun,
  type Run,
} from '@/lib/projects';
import type { Job } from '@/types';
import { useAuth } from './useAuth';

function runToHistoryEntry(run: Run): HistoryEntry {
  // Synthesize a Job-shaped object from the slim fields we persist. The big
  // arrays (brain_activations, timeseries, timestamps) are null — the UI will
  // render an "expired visualization" placeholder when you reopen a row.
  const job: Omit<Job, 'brain_activations'> = {
    job_id: run.job_id,
    status: (run.status as Job['status']) || 'completed',
    progress: 1,
    friction_score: run.friction_score ?? undefined,
    llm_analysis: run.llm_analysis ?? undefined,
    z_scores: (run.z_scores as unknown as Job['z_scores']) ?? undefined,
    timeseries: undefined,
    timestamps: undefined,
  };
  return {
    id: run.job_id,
    savedAt: new Date(run.created_at).getTime() || Date.now(),
    fileName: run.file_name,
    fileType: (run.file_type as HistoryEntry['fileType']) || 'other',
    fileSize: run.file_size,
    label: run.label ?? undefined,
    note: run.note ?? undefined,
    pinned: run.pinned || undefined,
    durationMs: run.duration_ms ?? undefined,
    job,
    serverRunId: run.id,
    projectId: run.project_id,
  };
}

export interface RecordInput {
  job: Job;
  fileName: string;
  fileType?: HistoryEntry['fileType'];
  fileSize?: number;
  durationMs?: number;
  /** Project this run belongs to (null = unfiled). */
  projectId?: string | null;
}

export function useHistory() {
  const { user, loading: authLoading } = useAuth();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [ready, setReady] = useState(false);
  const mirroredJobIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    setEntries(loadHistory());
    setReady(true);
  }, []);

  // When the auth state settles and we have a signed-in user, fetch the
  // server-side run list and merge it into the local cache.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const runs = await listRuns();
        if (cancelled) return;
        const serverEntries = runs.map(runToHistoryEntry);
        const merged = mergeServerEntries(serverEntries);
        // Prime the mirrored set so we don't re-POST them on next record().
        for (const r of runs) {
          mirroredJobIds.current.add(r.job_id);
        }
        setEntries(merged);
      } catch {
        // offline / not configured — silently fall back to local-only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const record = useCallback(
    (input: RecordInput) => {
      const entry = addHistoryEntry(input);
      setEntries(loadHistory());

      // Fire-and-forget mirror when signed in.
      if (user && !mirroredJobIds.current.has(entry.id)) {
        mirroredJobIds.current.add(entry.id);
        const fileType = input.fileType ?? entry.fileType;
        const fileSize = input.fileSize ?? entry.fileSize;
        createRun({
          job_id: entry.id,
          file_name: entry.fileName,
          file_type: fileType,
          file_size: fileSize,
          status: input.job.status,
          friction_score: input.job.friction_score ?? null,
          z_scores: (input.job.z_scores as unknown as Record<string, number>) ?? null,
          llm_analysis: input.job.llm_analysis ?? null,
          project_id: input.projectId ?? null,
          duration_ms: input.durationMs ?? null,
        })
          .then(run => {
            setHistoryServerLink(entry.id, {
              serverRunId: run.id,
              projectId: run.project_id,
            });
            setEntries(loadHistory());
          })
          .catch(() => {
            // Network failure — leave the local entry. Next reload() from the
            // effect above will eventually reconcile.
            mirroredJobIds.current.delete(entry.id);
          });
      }
      return entry;
    },
    [user],
  );

  const findServerRunId = useCallback((id: string): string | undefined => {
    const entry = loadHistory().find(e => e.id === id);
    return entry?.serverRunId;
  }, []);

  const remove = useCallback(
    (id: string) => {
      const serverId = findServerRunId(id);
      removeHistoryEntry(id);
      setEntries(loadHistory());
      if (user && serverId) {
        apiDeleteRun(serverId).catch(() => {});
      }
    },
    [user, findServerRunId],
  );

  const removeMany = useCallback(
    (ids: string[]) => {
      const serverIds = ids
        .map(id => findServerRunId(id))
        .filter((v): v is string => Boolean(v));
      removeHistoryEntries(ids);
      setEntries(loadHistory());
      if (user && serverIds.length) {
        for (const sid of serverIds) {
          apiDeleteRun(sid).catch(() => {});
        }
      }
    },
    [user, findServerRunId],
  );

  const rename = useCallback(
    (id: string, label: string) => {
      const serverId = findServerRunId(id);
      renameHistoryEntry(id, label);
      setEntries(loadHistory());
      if (user && serverId) {
        patchRun(serverId, { label: label.trim() || null }).catch(() => {});
      }
    },
    [user, findServerRunId],
  );

  const togglePin = useCallback(
    (id: string) => {
      const updated = togglePinHistoryEntry(id);
      setEntries(loadHistory());
      const serverId = updated?.serverRunId;
      if (user && serverId && updated) {
        patchRun(serverId, { pinned: !!updated.pinned }).catch(() => {});
      }
    },
    [user],
  );

  const setNote = useCallback(
    (id: string, note: string) => {
      const serverId = findServerRunId(id);
      setHistoryNote(id, note);
      setEntries(loadHistory());
      if (user && serverId) {
        patchRun(serverId, { note: note.trim() || null }).catch(() => {});
      }
    },
    [user, findServerRunId],
  );

  const moveToProject = useCallback(
    (id: string, projectId: string | null) => {
      const serverId = findServerRunId(id);
      setHistoryServerLink(id, { projectId });
      setEntries(loadHistory());
      if (user && serverId) {
        patchRun(serverId, { project_id: projectId ?? '' }).catch(() => {});
      }
    },
    [user, findServerRunId],
  );

  const exportBackup = useCallback((): string => {
    return exportHistoryAsBackup();
  }, []);

  const importBackup = useCallback((json: string): ImportResult => {
    const result = importHistoryFromBackup(json);
    if (result.ok) setEntries(loadHistory());
    return result;
  }, []);

  const clear = useCallback(() => {
    clearHistory();
    mirroredJobIds.current.clear();
    setEntries([]);
  }, []);

  return {
    entries,
    ready,
    record,
    remove,
    removeMany,
    rename,
    togglePin,
    setNote,
    moveToProject,
    exportBackup,
    importBackup,
    clear,
  };
}
