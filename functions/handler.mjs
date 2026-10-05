import { handleMcp as handleMcpProtocol } from "./mcp.mjs";
import { BusinessError, submitTestResult, addSolution, createRetest } from "./business.mjs";
const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const error = (code, status = 400) => json({ error: code }, status);

async function businessResponse(operation) {
  try { return json({ item: await operation() }, 201); }
  catch (err) {
    return err instanceof BusinessError ? error(err.code, err.httpStatus) : error("database_request_failed", 503);
  }
}

function parseBody(request) {
  return request.json().catch(() => null);
}

function getParams(url) {
  return new URL(url).searchParams;
}

function getAction(request) {
  const url = new URL(request.url);
  return url.searchParams.get("action") || "";
}

function getSubAction(request, prefix) {
  const action = getAction(request);
  return action.startsWith(prefix) ? action.slice(prefix.length) : action;
}

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

// --- Projects ---
async function handleProjects({ request, supabase }) {
  const action = getSubAction(request, "project_");
  if (action === "list") {
    const { data, error: err } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "get") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { data, error: err } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
    if (err) return error("database_request_failed", 503);
    return json({ item: data });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.name) return error("missing_name");
    const row = { id: uuid(), name: body.name, description: body.description || "", status: "active", tags: body.tags || [], created_at: now(), updated_at: now() };
    const { data, error: err } = await supabase.from("projects").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "update" && request.method === "PATCH") {
    const body = await parseBody(request);
    if (!body?.id) return error("missing_id");
    const { id, ...fields } = body;
    fields.updated_at = now();
    const { data, error: err } = await supabase.from("projects").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error("database_request_failed", 503);
    return json({ item: data });
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("projects").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Test Plans ---
async function handleTestPlans({ request, supabase }) {
  const action = getSubAction(request, "plan_");
  const pid = getParams(request.url).get("projectId");
  if (action === "list") {
    let q = supabase.from("test_plans").select("*").order("created_at", { ascending: false });
    if (pid) q = q.eq("project_id", pid);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.projectId || !body?.name) return error("missing_fields");
    const row = { id: uuid(), project_id: body.projectId, name: body.name, description: body.description || "", status: body.status || "draft", created_at: now(), updated_at: now() };
    const { data, error: err } = await supabase.from("test_plans").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "update" && request.method === "PATCH") {
    const body = await parseBody(request);
    if (!body?.id) return error("missing_id");
    const { id, ...fields } = body;
    fields.updated_at = now();
    const { data, error: err } = await supabase.from("test_plans").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error("database_request_failed", 503);
    return json({ item: data });
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("test_plans").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Test Cases ---
async function handleTestCases({ request, supabase }) {
  const action = getSubAction(request, "case_");
  const pid = getParams(request.url).get("projectId");
  const planId = getParams(request.url).get("planId");
  if (action === "list") {
    let q = supabase.from("test_cases").select("*").order("sort_order", { ascending: true });
    if (pid) q = q.eq("project_id", pid);
    if (planId) q = q.eq("plan_id", planId);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.projectId || !body?.name) return error("missing_fields");
    const row = {
      id: uuid(), project_id: body.projectId, plan_id: body.planId || null,
      name: body.name, description: body.description || "", precondition: body.precondition || "",
      steps: body.steps || "", expected: body.expected || "", priority: body.priority || "P1",
      sort_order: body.sortOrder ?? 0, status: "pending", created_at: now(), updated_at: now(),
    };
    const { data, error: err } = await supabase.from("test_cases").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "update" && request.method === "PATCH") {
    const body = await parseBody(request);
    if (!body?.id) return error("missing_id");
    const { id, ...fields } = body;
    fields.updated_at = now();
    if (["status", "latest_result_at", "latest_result_id", "latestResultAt", "latestResultId"].some(key => key in fields)) return error("case_state_requires_result", 409);
    const { data, error: err } = await supabase.from("test_cases").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error(err.code === "23514" ? "invalid_state_transition" : "database_request_failed", err.code === "23514" ? 409 : 503);
    return json({ item: data });
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("test_cases").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Test Runs ---
async function handleTestRuns({ request, supabase }) {
  const action = getSubAction(request, "run_");
  const pid = getParams(request.url).get("projectId");
  if (action === "list") {
    let q = supabase.from("test_runs").select("*").order("created_at", { ascending: false });
    if (pid) q = q.eq("project_id", pid);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.projectId || !body?.name) return error("missing_fields");
    const row = {
      id: uuid(), project_id: body.projectId, plan_id: body.planId || null,
      name: body.name, trigger_type: body.triggerType || "manual",
      environment: body.environment || "", status: "running",
      finished_at: null, created_at: now(), updated_at: now(),
    };
    const { data, error: err } = await supabase.from("test_runs").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "update" && request.method === "PATCH") {
    const body = await parseBody(request);
    if (!body?.id) return error("missing_id");
    if (body.status != null && !["running", "completed"].includes(body.status)) return error("invalid_run_status");
    if (Object.keys(body).some(key => !["id", "name", "environment", "status"].includes(key))) return error("invalid_fields");
    const { id, ...fields } = body;
    fields.updated_at = now();
    const { data, error: err } = await supabase.from("test_runs").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error(err.code === "23514" ? "invalid_state_transition" : "database_request_failed", err.code === "23514" ? 409 : 503);
    if (!data) return error("not_found", 404);
    return json({ item: data });
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("test_runs").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Test Results ---
async function handleTestResults({ request, supabase }) {
  const action = getSubAction(request, "result_");
  const runId = getParams(request.url).get("runId");
  const caseId = getParams(request.url).get("caseId");
  if (action === "list") {
    const params = getParams(request.url);
    const projectId = params.get("projectId");
    const resultId = params.get("resultId");
    const offset = Number(params.get("offset") ?? 0);
    const pageSize = Number(params.get("pageSize") ?? 100);
    const validId = value => !value || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    if (![projectId, runId, caseId, resultId].every(validId)) return error("invalid_id");
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 200) return error("invalid_pagination");
    const { data, error: err } = await supabase.rpc("dashboard_result_page", {
      p_project_id: projectId || null, p_run_id: runId || null, p_case_id: caseId || null,
      p_offset: offset, p_page_size: pageSize, p_result_id: resultId || null,
    });
    if (err || !data) return error("database_request_failed", 503);
    return json(data);
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.runId || !body?.caseId) return error("missing_fields");
    return businessResponse(() => submitTestResult(supabase, body));
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("test_results").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Defects ---
async function handleDefects({ request, supabase }) {
  const action = getSubAction(request, "defect_");
  const pid = getParams(request.url).get("projectId");
  if (action === "list") {
    let q = supabase.from("defects").select("*").order("created_at", { ascending: false });
    if (pid) q = q.eq("project_id", pid);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.projectId || !body?.title) return error("missing_fields");
    const row = {
      id: uuid(), project_id: body.projectId, result_id: body.resultId || null,
      case_id: body.caseId || null, title: body.title, description: body.description || "",
      severity: body.severity || "major", status: "open",
      created_at: now(), updated_at: now(),
    };
    const { data, error: err } = await supabase.from("defects").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "update" && request.method === "PATCH") {
    const body = await parseBody(request);
    if (!body?.id) return error("missing_id");
    const { id, ...fields } = body;
    fields.updated_at = now();
    const { data, error: err } = await supabase.from("defects").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error(err.code === "23514" ? "invalid_state_transition" : "database_request_failed", err.code === "23514" ? 409 : 503);
    if (!data) return error("not_found", 404);
    return json({ item: data });
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("defects").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Solutions ---
async function handleSolutions({ request, supabase }) {
  const action = getSubAction(request, "solution_");
  const defectId = getParams(request.url).get("defectId");
  if (action === "list") {
    let q = supabase.from("solutions").select("*").order("created_at", { ascending: true });
    if (defectId) q = q.eq("defect_id", defectId);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.defectId || !body?.title) return error("missing_fields");
    return businessResponse(() => addSolution(supabase, body));
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("solutions").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Retests ---
async function handleRetests({ request, supabase }) {
  const action = getSubAction(request, "retest_");
  const defectId = getParams(request.url).get("defectId");
  if (action === "list") {
    let q = supabase.from("retests").select("*").order("created_at", { ascending: true });
    if (defectId) q = q.eq("defect_id", defectId);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.defectId) return error("missing_fields");
    return businessResponse(() => createRetest(supabase, body));
  }
  return error("not_found", 404);
}

// --- External Tasks ---
async function handleExternalTasks({ request, supabase }) {
  const action = getSubAction(request, "task_");
  const pid = getParams(request.url).get("projectId");
  if (action === "list") {
    let q = supabase.from("external_tasks").select("*").order("created_at", { ascending: false });
    if (pid) q = q.eq("project_id", pid);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.projectId || !body?.title) return error("missing_fields");
    const row = {
      id: uuid(), project_id: body.projectId, title: body.title,
      source: body.source || "manual", external_id: body.externalId || "",
      external_url: body.externalUrl || "", created_at: now(),
    };
    const { data, error: err } = await supabase.from("external_tasks").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "delete" && request.method === "DELETE") {
    const id = getParams(request.url).get("id");
    if (!id) return error("missing_id");
    const { error: err } = await supabase.from("external_tasks").delete().eq("id", id);
    if (err) return error("database_request_failed", 503);
    return json({ ok: true });
  }
  return error("not_found", 404);
}

// --- Dashboard Stats ---
async function handleDashboard({ request, supabase }) {
  const action = getSubAction(request, "dashboard_");
  const pid = getParams(request.url).get("projectId");
  if (action !== "stats") return error("not_found", 404);

  if (pid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid)) return error("invalid_id");
  const { data, error: err } = await supabase.rpc("dashboard_stats", { p_project_id: pid || null });
  if (err || !data) return error("database_request_failed", 503);
  return json(data);
}

// --- MCP Endpoint ---
// Tool dispatch reuses REST behavior, including its atomic business transitions.
async function handleMcp(context) {
  return handleMcpProtocol({ ...context, dispatch: handleApp });
}
// --- Main Router ---
export async function handleApp({ request, supabase }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // MCP endpoint
  if (path.endsWith("/mcp")) {
    return handleMcp({ request, supabase });
  }

  // API routing by action param
  const action = getAction(request);

  if (action.startsWith("project")) return handleProjects({ request, supabase });
  if (action.startsWith("plan")) return handleTestPlans({ request, supabase });
  if (action.startsWith("case")) return handleTestCases({ request, supabase });
  if (action.startsWith("run")) return handleTestRuns({ request, supabase });
  if (action.startsWith("result")) return handleTestResults({ request, supabase });
  if (action.startsWith("defect")) return handleDefects({ request, supabase });
  if (action.startsWith("solution")) return handleSolutions({ request, supabase });
  if (action.startsWith("retest")) return handleRetests({ request, supabase });
  if (action.startsWith("task")) return handleExternalTasks({ request, supabase });
  if (action.startsWith("dashboard")) return handleDashboard({ request, supabase });

  // Health check
  if (action === "health" || path === "/") {
    return json({ ok: true, service: "test-dashboard-api" });
  }

  return error("not_found", 404);
}
