'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import UploadView from '@/components/UploadView';
import ProcessingView from '@/components/ProcessingView';
import ResultsView from '@/components/ResultsView';
import CompareView from '@/components/CompareView';
import KeyboardHelp from '@/components/KeyboardHelp';
import { addHistoryEntry, type HistoryEntry } from '@/lib/history';
import type { Job } from '@/types';

type View = 'upload' | 'processing' | 'results' | 'compare';

interface PendingUpload {
  fileName: string;
  fileSize: number;
}

export default function Page() {
  const [view, setView] = useState<View>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Job | null>(null);
  const [activeEntryMeta, setActiveEntryMeta] = useState<{ label?: string; note?: string } | null>(null);
  const [compareEntries, setCompareEntries] = useState<[HistoryEntry, HistoryEntry] | null>(null);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const pendingRef = useRef<PendingUpload | null>(null);

  // Browser back/forward support
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const v: View = (e.state?.view as View) ?? 'upload';
      setView(v);
      if (v === 'upload') { setJobId(null); setJobData(null); }
    };
    window.addEventListener('popstate', handlePopState);
    // Set initial history entry
    history.replaceState({ view: 'upload' }, '', '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const startProcessing = useCallback((id: string, pending?: PendingUpload) => {
    pendingRef.current = pending ?? null;
    setJobId(id);
    setJobData(null);
    setView('processing');
    // replaceState so back goes to upload, not back to processing
    history.replaceState({ view: 'processing' }, '', '#processing');
  }, []);

  const showResults = useCallback((data: Job) => {
    setJobData(data);
    setActiveEntryMeta(null);
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
    const pending = pendingRef.current;
    try {
      addHistoryEntry({
        job: data,
        fileName: pending?.fileName || 'Untitled analysis',
        fileSize: pending?.fileSize ?? 0,
      });
    } catch {
      // non-fatal
    }
    pendingRef.current = null;
  }, []);

  const openFromHistory = useCallback((entry: HistoryEntry) => {
    pendingRef.current = null;
    setJobId(null);
    setJobData(entry.job as Job);
    setActiveEntryMeta({ label: entry.label, note: entry.note });
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
  }, []);

  const showCompare = useCallback((a: HistoryEntry, b: HistoryEntry) => {
    setCompareEntries([a, b]);
    setView('compare');
    history.pushState({ view: 'compare' }, '', '#compare');
  }, []);

  const showUpload = useCallback(() => {
    setJobId(null);
    setJobData(null);
    setCompareEntries(null);
    setActiveEntryMeta(null);
    pendingRef.current = null;
    setView('upload');
    history.pushState({ view: 'upload' }, '', '');
  }, []);

  // Global keyboard shortcuts. Skip if the user is typing in an input/textarea.
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (target as HTMLElement).isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
      // "?" always opens help, even if a modal is already open (it toggles off).
      if (e.key === '?' && !isTyping(e)) {
        e.preventDefault();
        setKeyboardHelpOpen(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (keyboardHelpOpen) {
          setKeyboardHelpOpen(false);
          return;
        }
      }
      if (isTyping(e)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        showUpload();
      } else if (e.key === '/') {
        e.preventDefault();
        const search = document.querySelector<HTMLInputElement>('input.history-search');
        search?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keyboardHelpOpen, showUpload]);

  return (
    <>
      <div className="scanline-overlay" />
      <div className="grain-overlay" />
      <Header onShowShortcuts={() => setKeyboardHelpOpen(true)} />
      <main>
        {view === 'upload' && (
          <UploadView
            onStartProcessing={startProcessing}
            onOpenHistory={openFromHistory}
            onCompareHistory={showCompare}
          />
        )}
        {view === 'processing' && jobId && (
          <ProcessingView
            jobId={jobId}
            onComplete={showResults}
            onCancel={showUpload}
          />
        )}
        {view === 'results' && jobData && (
          <ResultsView
            jobData={jobData}
            onNewAnalysis={showUpload}
            entryLabel={activeEntryMeta?.label}
            entryNote={activeEntryMeta?.note}
          />
        )}
        {view === 'compare' && compareEntries && (
          <CompareView
            entryA={compareEntries[0]}
            entryB={compareEntries[1]}
            onOpenA={openFromHistory}
            onOpenB={openFromHistory}
            onExit={showUpload}
          />
        )}
      </main>
      <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
    </>
  );
}
