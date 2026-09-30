import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { store } from '@/lib/store';
import type { User, Project } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true, login: () => false, logout: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(store.getCurrentUser());
    setLoading(false);
    return store.subscribe(() => setUser(store.getCurrentUser()));
  }, []);

  const login = useCallback((username: string, password: string) => {
    const result = store.login(username, password);
    if (result) { setUser(result.user); return true; }
    return false;
  }, []);

  const logout = useCallback(() => {
    store.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() { return useContext(AuthContext); }

interface ProjectContextType {
  currentProject: Project | null;
  projects: Project[];
  setProjectId: (id: string) => void;
  refresh: () => void;
}

const ProjectContext = createContext<ProjectContextType>({ currentProject: null, projects: [], setProjectId: () => {}, refresh: () => {} });

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(store.getProjects());
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    () => localStorage.getItem('currentProjectId')
  );

  const refresh = useCallback(() => {
    setProjects(store.getProjects());
  }, []);

  useEffect(() => {
    return store.subscribe(() => {
      setProjects(store.getProjects());
    });
  }, []);

  const currentProject = projects.find(p => p.id === currentProjectId) ?? projects[0] ?? null;

  const setProjectId = useCallback((id: string) => {
    setCurrentProjectId(id);
    localStorage.setItem('currentProjectId', id);
  }, []);

  return (
    <ProjectContext.Provider value={{ currentProject, projects, setProjectId, refresh }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() { return useContext(ProjectContext); }
