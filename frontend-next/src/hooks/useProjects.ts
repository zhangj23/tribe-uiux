'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listProjects,
  createProject as apiCreate,
  updateProject as apiUpdate,
  deleteProject as apiDelete,
  type Project,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from '@/lib/projects';
import { useAuth } from './useAuth';

const CURRENT_PROJECT_KEY = 'tribe.currentProjectId';

export interface UseProjectsResult {
  projects: Project[];
  loading: boolean;
  error: string | null;
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  reload: () => Promise<void>;
  create: (input: ProjectCreateInput) => Promise<Project>;
  update: (id: string, patch: ProjectUpdateInput) => Promise<Project>;
  remove: (id: string) => Promise<void>;
}

export function useProjects(): UseProjectsResult {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Read the persisted "currently open project" id on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      setCurrentProjectId(window.localStorage.getItem(CURRENT_PROJECT_KEY));
    } catch {
      // ignore
    }
  }, []);

  const reload = useCallback(async () => {
    if (!user) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await listProjects();
      setProjects(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Load when auth settles or the user id changes.
  useEffect(() => {
    if (authLoading) return;
    void reload();
  }, [authLoading, user, reload]);

  const create = useCallback(
    async (input: ProjectCreateInput) => {
      const project = await apiCreate(input);
      setProjects(prev => [project, ...prev.filter(p => p.id !== project.id)]);
      return project;
    },
    [],
  );

  const update = useCallback(
    async (id: string, patch: ProjectUpdateInput) => {
      const project = await apiUpdate(id, patch);
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, ...project } : p)));
      return project;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await apiDelete(id);
    setProjects(prev => prev.filter(p => p.id !== id));
    setCurrentProjectId(prev => {
      if (prev === id) {
        try {
          window.localStorage.removeItem(CURRENT_PROJECT_KEY);
        } catch {
          // ignore
        }
        return null;
      }
      return prev;
    });
  }, []);

  const setCurrentProject = useCallback((project: Project | null) => {
    setCurrentProjectId(project ? project.id : null);
    try {
      if (project) {
        window.localStorage.setItem(CURRENT_PROJECT_KEY, project.id);
      } else {
        window.localStorage.removeItem(CURRENT_PROJECT_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const currentProject =
    (currentProjectId && projects.find(p => p.id === currentProjectId)) || null;

  return {
    projects,
    loading,
    error,
    currentProject,
    setCurrentProject,
    reload,
    create,
    update,
    remove,
  };
}
