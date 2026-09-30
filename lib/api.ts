const API_BASE = "/functions/v1/app";

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (key === 'name' && !('name' in obj)) continue;
    result[camelKey] = value;
  }
  return result;
}

function toCamelCase<T>(obj: Record<string, unknown> | null): T {
  if (!obj) return null as unknown as T;
  const r = toCamel(obj);
  if ('name' in obj && !('title' in obj) && !('name' in r)) {
    // keep name as-is for projects
  }
  return r as T;
}

function toCamelList<T>(items: Record<string, unknown>[]): T[] {
  return items.map(i => toCamelCase<T>(i));
}

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
  getProjects: async () => {
    const res = await requestJson(`${API_BASE}?action=project_list`);
    return toCamelList(res.items);
  },

  getProject: async (id: string) => {
    const res = await requestJson(`${API_BASE}?action=project_get&id=${id}`);
    return res.item as Record<string, unknown> | null;
  },

  createProject: async (name: string, description?: string, tags?: string[]) => {
    const res = await requestJson(`${API_BASE}?action=project_create`, {
      method: "POST",
      body: JSON.stringify({ name, description, tags }),
    });
    return res.item;
  },

  updateProject: async (id: string, fields: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=project_update`, {
      method: "PATCH",
      body: JSON.stringify({ id, ...fields }),
    });
    return res.item;
  },

  deleteProject: async (id: string) => {
    await requestJson(`${API_BASE}?action=project_delete&id=${id}`, { method: "DELETE" });
  },

  getTestPlans: async (projectId?: string) => {
    const res = await requestJson(`${API_BASE}?action=plan_list${projectId ? `&projectId=${projectId}` : ""}`);
    return toCamelList(res.items).map((p: any) => ({ ...p, title: p.name || p.title }));
  },

  createTestPlan: async (projectId: string, title: string, description?: string) => {
    const res = await requestJson(`${API_BASE}?action=plan_create`, {
      method: "POST",
      body: JSON.stringify({ projectId, name: title, description }),
    });
    return { ...(toCamelCase(res.item) as Record<string, unknown>), title: res.item?.name };
  },

  updateTestPlan: async (id: string, fields: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=plan_update`, {
      method: "PATCH",
      body: JSON.stringify({ id, ...fields }),
    });
    return res.item;
  },

  deleteTestPlan: async (id: string) => {
    await requestJson(`${API_BASE}?action=plan_delete&id=${id}`, { method: "DELETE" });
  },

  getTestCases: async (projectId?: string, planId?: string) => {
    const res = await requestJson(`${API_BASE}?action=case_list${projectId ? `&projectId=${projectId}` : ""}${planId ? `&planId=${planId}` : ""}`);
    return toCamelList(res.items).map((c: any) => ({
      ...c,
      expectedResult: c.expected || c.expectedResult || '',
      executionOrder: c.sortOrder ?? c.executionOrder ?? 0,
    }));
  },

  createTestCase: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=case_create`, {
      method: "POST",
      body: JSON.stringify({
        projectId: data.projectId,
        planId: data.planId,
        name: data.name,
        description: data.description,
        precondition: data.precondition,
        steps: data.steps,
        expected: data.expectedResult || data.expected,
        priority: data.priority,
        sortOrder: data.executionOrder ?? data.sortOrder ?? 0,
      }),
    });
    return res.item;
  },

  updateTestCase: async (id: string, fields: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=case_update`, {
      method: "PATCH",
      body: JSON.stringify({ id, ...fields }),
    });
    return res.item;
  },

  deleteTestCase: async (id: string) => {
    await requestJson(`${API_BASE}?action=case_delete&id=${id}`, { method: "DELETE" });
  },

  getTestRuns: async (projectId?: string) => {
    const res = await requestJson(`${API_BASE}?action=run_list${projectId ? `&projectId=${projectId}` : ""}`);
    return toCamelList(res.items).map((r: any) => ({
      ...r,
      trigger: r.triggerType || r.trigger || 'manual',
      startedAt: r.createdAt || r.startedAt,
      finishedAt: r.updatedAt || r.finishedAt,
    }));
  },

  createTestRun: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=run_create`, {
      method: "POST",
      body: JSON.stringify({
        projectId: data.projectId,
        planId: data.planId,
        name: data.name,
        triggerType: data.trigger,
        environment: data.environment,
      }),
    });
    return res.item;
  },

  updateTestRun: async (id: string, fields: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=run_update`, {
      method: "PATCH",
      body: JSON.stringify({ id, ...fields }),
    });
    return res.item;
  },

  getTestResults: async (runId?: string, caseId?: string) => {
    const res = await requestJson(`${API_BASE}?action=result_list${runId ? `&runId=${runId}` : ""}${caseId ? `&caseId=${caseId}` : ""}`);
    return toCamelList(res.items).map((r: any) => ({
      ...r,
      actualResult: r.description || r.actualResult || '',
      errorLog: r.errorLog || '',
      durationMs: r.durationMs ?? 0,
      executedAt: r.createdAt || r.executedAt,
      executedBy: r.executedBy || '',
    }));
  },

  createTestResult: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=result_create`, {
      method: "POST",
      body: JSON.stringify({
        runId: data.runId,
        caseId: data.caseId,
        status: data.status,
        description: data.actualResult || data.description,
        durationMs: data.durationMs || 0,
      }),
    });
    return res.item;
  },

  getDefects: async (projectId?: string) => {
    const res = await requestJson(`${API_BASE}?action=defect_list${projectId ? `&projectId=${projectId}` : ""}`);
    return toCamelList(res.items);
  },

  createDefect: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=defect_create`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    return res.item;
  },

  updateDefect: async (id: string, fields: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=defect_update`, {
      method: "PATCH",
      body: JSON.stringify({ id, ...fields }),
    });
    return res.item;
  },

  deleteDefect: async (id: string) => {
    await requestJson(`${API_BASE}?action=defect_delete&id=${id}`, { method: "DELETE" });
  },

  getSolutions: async (defectId?: string) => {
    const res = await requestJson(`${API_BASE}?action=solution_list${defectId ? `&defectId=${defectId}` : ""}`);
    return toCamelList(res.items).map((s: any) => ({
      ...s,
      fixCommitUrl: s.commitUrl || s.fixCommitUrl || '',
    }));
  },

  createSolution: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=solution_create`, {
      method: "POST",
      body: JSON.stringify({
        defectId: data.defectId,
        title: data.title,
        rootCause: data.rootCause,
        fixDescription: data.fixDescription,
        commitUrl: data.fixCommitUrl || data.commitUrl,
      }),
    });
    return res.item;
  },

  getRetests: async (defectId?: string) => {
    const res = await requestJson(`${API_BASE}?action=retest_list${defectId ? `&defectId=${defectId}` : ""}`);
    return toCamelList(res.items).map((r: any) => ({
      ...r,
      retestedAt: r.createdAt || r.retestedAt,
    }));
  },

  createRetest: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=retest_create`, {
      method: "POST",
      body: JSON.stringify({
        defectId: data.defectId,
        status: data.status,
        notes: data.notes,
      }),
    });
    return res.item;
  },

  getExternalTasks: async (projectId?: string) => {
    const res = await requestJson(`${API_BASE}?action=task_list${projectId ? `&projectId=${projectId}` : ""}`);
    return toCamelList(res.items);
  },

  createExternalTask: async (data: Record<string, unknown>) => {
    const res = await requestJson(`${API_BASE}?action=task_create`, {
      method: "POST",
      body: JSON.stringify({
        projectId: data.projectId,
        title: data.title,
        source: data.source,
        externalId: data.externalId,
        externalUrl: data.externalUrl,
      }),
    });
    return res.item;
  },

  deleteExternalTask: async (id: string) => {
    await requestJson(`${API_BASE}?action=task_delete&id=${id}`, { method: "DELETE" });
  },

  getDashboard: async (projectId?: string) => {
    return requestJson(`${API_BASE}?action=dashboard_stats${projectId ? `&projectId=${projectId}` : ""}`);
  },

  health: async () => requestJson(`${API_BASE}?action=health`),
};
