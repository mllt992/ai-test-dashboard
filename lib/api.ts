const API_BASE = "/functions/v1/app";

async function requestJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Projects
  getProjects: () => requestJson(`${API_BASE}?action=project_list`),
  getProject: (id: string) => requestJson(`${API_BASE}?action=project_get&id=${id}`),
  createProject: (name: string, description?: string) =>
    requestJson(`${API_BASE}?action=project_create`, { method: "POST", body: JSON.stringify({ name, description }) }),
  updateProject: (id: string, fields: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=project_update`, { method: "PATCH", body: JSON.stringify({ id, ...fields }) }),
  deleteProject: (id: string) => requestJson(`${API_BASE}?action=project_delete&id=${id}`, { method: "DELETE" }),

  // Test Plans
  getTestPlans: (projectId?: string) =>
    requestJson(`${API_BASE}?action=plan_list${projectId ? `&projectId=${projectId}` : ""}`),
  createTestPlan: (projectId: string, name: string, description?: string) =>
    requestJson(`${API_BASE}?action=plan_create`, { method: "POST", body: JSON.stringify({ projectId, name, description }) }),
  updateTestPlan: (id: string, fields: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=plan_update`, { method: "PATCH", body: JSON.stringify({ id, ...fields }) }),
  deleteTestPlan: (id: string) => requestJson(`${API_BASE}?action=plan_delete&id=${id}`, { method: "DELETE" }),

  // Test Cases
  getTestCases: (projectId?: string, planId?: string) =>
    requestJson(`${API_BASE}?action=case_list${projectId ? `&projectId=${projectId}` : ""}${planId ? `&planId=${planId}` : ""}`),
  createTestCase: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=case_create`, { method: "POST", body: JSON.stringify(data) }),
  updateTestCase: (id: string, fields: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=case_update`, { method: "PATCH", body: JSON.stringify({ id, ...fields }) }),
  deleteTestCase: (id: string) => requestJson(`${API_BASE}?action=case_delete&id=${id}`, { method: "DELETE" }),

  // Test Runs
  getTestRuns: (projectId?: string) =>
    requestJson(`${API_BASE}?action=run_list${projectId ? `&projectId=${projectId}` : ""}`),
  createTestRun: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=run_create`, { method: "POST", body: JSON.stringify(data) }),
  updateTestRun: (id: string, fields: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=run_update`, { method: "PATCH", body: JSON.stringify({ id, ...fields }) }),
  deleteTestRun: (id: string) => requestJson(`${API_BASE}?action=run_delete&id=${id}`, { method: "DELETE" }),

  // Test Results
  getTestResults: (runId?: string, caseId?: string) =>
    requestJson(`${API_BASE}?action=result_list${runId ? `&runId=${runId}` : ""}${caseId ? `&caseId=${caseId}` : ""}`),
  createTestResult: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=result_create`, { method: "POST", body: JSON.stringify(data) }),
  deleteTestResult: (id: string) => requestJson(`${API_BASE}?action=result_delete&id=${id}`, { method: "DELETE" }),

  // Defects
  getDefects: (projectId?: string) =>
    requestJson(`${API_BASE}?action=defect_list${projectId ? `&projectId=${projectId}` : ""}`),
  createDefect: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=defect_create`, { method: "POST", body: JSON.stringify(data) }),
  updateDefect: (id: string, fields: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=defect_update`, { method: "PATCH", body: JSON.stringify({ id, ...fields }) }),
  deleteDefect: (id: string) => requestJson(`${API_BASE}?action=defect_delete&id=${id}`, { method: "DELETE" }),

  // Solutions
  getSolutions: (defectId?: string) =>
    requestJson(`${API_BASE}?action=solution_list${defectId ? `&defectId=${defectId}` : ""}`),
  createSolution: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=solution_create`, { method: "POST", body: JSON.stringify(data) }),
  deleteSolution: (id: string) => requestJson(`${API_BASE}?action=solution_delete&id=${id}`, { method: "DELETE" }),

  // Retests
  getRetests: (defectId?: string) =>
    requestJson(`${API_BASE}?action=retest_list${defectId ? `&defectId=${defectId}` : ""}`),
  createRetest: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=retest_create`, { method: "POST", body: JSON.stringify(data) }),

  // External Tasks
  getExternalTasks: (projectId?: string) =>
    requestJson(`${API_BASE}?action=task_list${projectId ? `&projectId=${projectId}` : ""}`),
  createExternalTask: (data: Record<string, unknown>) =>
    requestJson(`${API_BASE}?action=task_create`, { method: "POST", body: JSON.stringify(data) }),
  deleteExternalTask: (id: string) => requestJson(`${API_BASE}?action=task_delete&id=${id}`, { method: "DELETE" }),

  // Dashboard
  getDashboard: (projectId?: string) =>
    requestJson(`${API_BASE}?action=dashboard_stats${projectId ? `&projectId=${projectId}` : ""}`),

  // Health
  health: () => requestJson(`${API_BASE}?action=health`),
};
