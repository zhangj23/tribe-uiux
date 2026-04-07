'use client';

import { useState, useCallback, useEffect } from 'react';
import Header from '@/components/Header';
import UploadView from '@/components/UploadView';
import ProcessingView from '@/components/ProcessingView';
import ResultsView from '@/components/ResultsView';
import type { Job } from '@/types';

type View = 'upload' | 'processing' | 'results';

export default function Page() {
  const [view, setView] = useState<View>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Job | null>(null);

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

  const startProcessing = useCallback((id: string) => {
    setJobId(id);
    setJobData(null);
    setView('processing');
    // replaceState so back goes to upload, not back to processing
    history.replaceState({ view: 'processing' }, '', '#processing');
  }, []);

  const showResults = useCallback((data: Job) => {
    setJobData(data);
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
  }, []);

  const showUpload = useCallback(() => {
    setJobId(null);
    setJobData(null);
    setView('upload');
    history.pushState({ view: 'upload' }, '', '');
  }, []);

  return (
    <>
      <div className="scanline-overlay" />
      <div className="grain-overlay" />
      <Header />
      <main>
        {view === 'upload' && (
          <UploadView onStartProcessing={startProcessing} />
        )}
        {view === 'processing' && jobId && (
          <ProcessingView
            jobId={jobId}
            onComplete={showResults}
            onCancel={showUpload}
          />
        )}
        {view === 'results' && jobData && (
          <ResultsView jobData={jobData} onNewAnalysis={showUpload} />
        )}
      </main>
    </>
  );
}
