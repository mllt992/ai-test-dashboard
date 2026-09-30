import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, ProjectProvider, useAuth } from "@/store/context";
import { Sidebar } from "@/components/layout/Sidebar";
import LoginPage from "@/pages/Login";
import OverviewPage from "@/pages/Overview";
import ProjectsPage from "@/pages/Projects";
import ProjectOverviewPage from "@/pages/ProjectOverview";
import TestPlansPage from "@/pages/TestPlans";
import TestCasesPage from "@/pages/TestCases";
import TestRunsPage from "@/pages/TestRuns";
import DefectsPage from "@/pages/Defects";
import ExternalTasksPage from "@/pages/ExternalTasks";
import DashboardPage from "@/pages/Dashboard";
import SettingsPage from "@/pages/Settings";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50/80 p-6 lg:p-8">
        {children ?? <Outlet />}
      </main>
    </div>
  );
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/overview" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ProjectProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/p/:id/overview" element={<ProjectOverviewPage />} />
              <Route path="/p/:id/plans" element={<TestPlansPage />} />
              <Route path="/p/:id/cases" element={<TestCasesPage />} />
              <Route path="/p/:id/runs" element={<TestRunsPage />} />
              <Route path="/p/:id/defects" element={<DefectsPage />} />
              <Route path="/p/:id/tasks" element={<ExternalTasksPage />} />
              <Route path="/p/:id/dashboard" element={<DashboardPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </ProjectProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
