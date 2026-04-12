'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import UploadView from '@/components/UploadView';
import ProcessingView from '@/components/ProcessingView';
import ResultsView from '@/components/ResultsView';
import CompareView from '@/components/CompareView';
import KeyboardHelp from '@/components/KeyboardHelp';
import LoginView from '@/components/LoginView';
import ProjectSidebar from '@/components/ProjectSidebar';
import ProjectView from '@/components/ProjectView';
import { useAuth } from '@/hooks/useAuth';
import { useProjects } from '@/hooks/useProjects';
import { useHistory } from '@/hooks/useHistory';
import { AUTH_REQUIRED, SUPABASE_CONFIGURED } from '@/lib/supabase';
import { applyTabIdentity, resetTabIdentity } from '@/lib/tabIdentity';
import type { HistoryEntry } from '@/lib/history';
import type { Job } from '@/types';
import type { Run } from '@/lib/projects';

type View = 'upload' | 'processing' | 'results' | 'compare' | 'project' | 'login';

interface PendingUpload {
  fileName: string;
  fileSize: number;
  startedAt: number;
}

function runToJob(run: Run): Job {
  return {
    job_id: run.job_id,
    status: (run.status as Job['status']) || 'completed',
    progress: 1,
    friction_score: run.friction_score ?? undefined,
    llm_analysis: run.llm_analysis ?? undefined,
    z_scores: (run.z_scores as unknown as Job['z_scores']) ?? undefined,
  };
}

export default function Page() {
  const { user, loading: authLoading, disabled: authDisabled } = useAuth();
  const {
    projects,
    loading: projectsLoading,
    currentProject,
    setCurrentProject,
    create: createProject,
    update: updateProject,
    remove: removeProject,
    reload: reloadProjects,
  } = useProjects();
  const { record: recordHistory } = useHistory();

  const [view, setView] = useState<View>('upload');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobData, setJobData] = useState<Job | null>(null);
  const [activeEntryMeta, setActiveEntryMeta] = useState<{ label?: string; note?: string } | null>(null);
  const [compareEntries, setCompareEntries] = useState<[HistoryEntry, HistoryEntry] | null>(null);
  const [compareSeedId, setCompareSeedId] = useState<string | null>(null);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [openedProjectId, setOpenedProjectId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [forceLogin, setForceLogin] = useState(false);
  const pendingRef = useRef<PendingUpload | null>(null);

  // Browser back/forward support
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const v: View = (e.state?.view as View) ?? 'upload';
      setView(v);
      if (v === 'upload') { setJobId(null); setJobData(null); }
    };
    window.addEventListener('popstate', handlePopState);
    history.replaceState({ view: 'upload' }, '', '');
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const startProcessing = useCallback((id: string, pending?: { fileName: string; fileSize: number }) => {
    pendingRef.current = pending
      ? { ...pending, startedAt: Date.now() }
      : null;
    setJobId(id);
    setJobData(null);
    setView('processing');
    history.replaceState({ view: 'processing' }, '', '#processing');
  }, []);

  const showResults = useCallback((data: Job) => {
    setJobData(data);
    setActiveEntryMeta(null);
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
    const pending = pendingRef.current;
    try {
      recordHistory({
        job: data,
        fileName: pending?.fileName || 'Untitled analysis',
        fileSize: pending?.fileSize ?? 0,
        durationMs: pending?.startedAt ? Date.now() - pending.startedAt : undefined,
        projectId: currentProject?.id ?? null,
      });
    } catch {
      // non-fatal
    }
    pendingRef.current = null;
    // Refresh project list so run counts / best scores are up to date in the sidebar.
    if (currentProject) {
      void reloadProjects();
    }
  }, [recordHistory, currentProject, reloadProjects]);

  const openFromHistory = useCallback((entry: HistoryEntry) => {
    pendingRef.current = null;
    setJobId(null);
    setJobData(entry.job as Job);
    setActiveEntryMeta({ label: entry.label, note: entry.note });
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
  }, []);

  const openRun = useCallback((run: Run) => {
    pendingRef.current = null;
    setJobId(null);
    setJobData(runToJob(run));
    setActiveEntryMeta({ label: run.label ?? undefined, note: run.note ?? undefined });
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
  }, []);

  const openDemo = useCallback((data: Job) => {
    pendingRef.current = null;
    setJobId(null);
    setJobData(data);
    setActiveEntryMeta({
      label: 'Sample analysis',
      note: 'Demo data — no real upload was processed.',
    });
    setView('results');
    history.pushState({ view: 'results' }, '', '#results');
  }, []);

  const showCompare = useCallback((a: HistoryEntry, b: HistoryEntry) => {
    setCompareEntries([a, b]);
    setCompareSeedId(null);
    setView('compare');
    history.pushState({ view: 'compare' }, '', '#compare');
  }, []);

  const startCompareWith = useCallback((seedJobId: string) => {
    setCompareSeedId(seedJobId);
    setJobId(null);
    setJobData(null);
    setActiveEntryMeta(null);
    pendingRef.current = null;
    setView('upload');
    history.pushState({ view: 'upload' }, '', '');
  }, []);

  const showUpload = useCallback(() => {
    setJobId(null);
    setJobData(null);
    setCompareEntries(null);
    setActiveEntryMeta(null);
    setCompareSeedId(null);
    pendingRef.current = null;
    setView('upload');
    history.pushState({ view: 'upload' }, '', '');
  }, []);

  const showProjectPage = useCallback((projectId: string) => {
    setOpenedProjectId(projectId);
    setView('project');
    history.pushState({ view: 'project' }, '', '#project');
  }, []);

  const showLogin = useCallback(() => {
    setForceLogin(true);
    setView('login');
    history.pushState({ view: 'login' }, '', '#login');
  }, []);

  // Tab identity
  useEffect(() => {
    if (view === 'results' && jobData?.friction_score != null) {
      applyTabIdentity({
        frictionScore: jobData.friction_score,
        label: activeEntryMeta?.label,
      });
    } else {
      resetTabIdentity();
    }
    return () => {
      resetTabIdentity();
    };
  }, [view, jobData, activeEntryMeta]);

  // Global keyboard shortcuts
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || (target as HTMLElement).isContentEditable;
    };

    const onKey = (e: KeyboardEvent) => {
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

  // Clear the "forceLogin" gate once a user signs in.
  useEffect(() => {
    if (user && forceLogin) {
      setForceLogin(false);
      showUpload();
    }
  }, [user, forceLogin, showUpload]);

  // AuthGate: when auth is required (either via env var or a user-initiated
  // "Sign in" click), show the login view until the user is signed in.
  const mustLogin = !authDisabled && !authLoading && !user && (AUTH_REQUIRED || forceLogin);
  const showingLogin = mustLogin || view === 'login';

  // Hide sidebar entirely when anonymous or during the login gate.
  const showSidebar = !authDisabled && !!user && !showingLogin;

  return (
    <>
      <div className="scanline-overlay" />
      <div className="grain-overlay" />
      <Header
        onShowShortcuts={() => setKeyboardHelpOpen(true)}
        onHome={showUpload}
        isHome={view === 'upload'}
        frictionScore={view === 'results' ? jobData?.friction_score : undefined}
        onShowLogin={SUPABASE_CONFIGURED && !user ? showLogin : undefined}
      />
      <div className={`app-shell${showSidebar ? ' app-shell--with-sidebar' : ''}${sidebarCollapsed ? ' app-shell--collapsed' : ''}`}>
        {showSidebar && (
          <ProjectSidebar
            projects={projects}
            currentProject={currentProject}
            loading={projectsLoading}
            onSelect={setCurrentProject}
            onOpenProject={p => showProjectPage(p.id)}
            onCreate={async (name, description) => {
              const p = await createProject({ name, description });
              setCurrentProject(p);
            }}
            onDelete={async id => {
              await removeProject(id);
            }}
            onRename={async (id, name) => {
              await updateProject(id, { name });
            }}
            collapsed={sidebarCollapsed}
            onToggleCollapsed={() => setSidebarCollapsed(c => !c)}
          />
        )}
        <main className="app-main">
          {showingLogin ? (
            <LoginView
              onContinueAnonymous={
                AUTH_REQUIRED
                  ? undefined
                  : () => {
                      setForceLogin(false);
                      showUpload();
                    }
              }
            />
          ) : (
            <>
              {view === 'upload' && (
                <UploadView
                  onStartProcessing={startProcessing}
                  onOpenHistory={openFromHistory}
                  onCompareHistory={showCompare}
                  onOpenDemo={openDemo}
                  compareSeedId={compareSeedId}
                  onCompareSeedConsumed={() => setCompareSeedId(null)}
                  currentProject={currentProject}
                  onClearCurrentProject={() => setCurrentProject(null)}
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
                  onCompareWith={startCompareWith}
                  currentProject={currentProject}
                  onOpenRun={openRun}
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
              {view === 'project' && openedProjectId && (
                <ProjectView
                  projectId={openedProjectId}
                  onOpenRun={openRun}
                  onBack={showUpload}
                />
              )}
            </>
          )}
        </main>
      </div>
      <KeyboardHelp open={keyboardHelpOpen} onClose={() => setKeyboardHelpOpen(false)} />
    </>
  );
}
