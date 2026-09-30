const json = (body, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const error = (code, status = 400) => json({ error: code }, status);

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

function uuid() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

// --- Projects ---
async function handleProjects({ request, supabase }) {
  const action = getAction(request);
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
  const action = getAction(request);
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
  const action = getAction(request);
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
    const { data, error: err } = await supabase.from("test_cases").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error("database_request_failed", 503);
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
  const action = getAction(request);
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
      created_at: now(), updated_at: now(),
    };
    const { data, error: err } = await supabase.from("test_runs").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  if (action === "update" && request.method === "PATCH") {
    const body = await parseBody(request);
    if (!body?.id) return error("missing_id");
    const { id, ...fields } = body;
    fields.updated_at = now();
    const { data, error: err } = await supabase.from("test_runs").update(fields).eq("id", id).select().maybeSingle();
    if (err) return error("database_request_failed", 503);
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
  const action = getAction(request);
  const runId = getParams(request.url).get("runId");
  const caseId = getParams(request.url).get("caseId");
  if (action === "list") {
    let q = supabase.from("test_results").select("*").order("created_at", { ascending: false });
    if (runId) q = q.eq("run_id", runId);
    if (caseId) q = q.eq("case_id", caseId);
    const { data, error: err } = await q;
    if (err) return error("database_request_failed", 503);
    return json({ items: data || [] });
  }
  if (action === "create" && request.method === "POST") {
    const body = await parseBody(request);
    if (!body?.runId || !body?.caseId) return error("missing_fields");
    const row = {
      id: uuid(), run_id: body.runId, case_id: body.caseId,
      status: body.status || "passed", description: body.description || "",
      duration_ms: body.durationMs || 0, screenshots: body.screenshots || [],
      created_at: now(),
    };
    const { data, error: err } = await supabase.from("test_results").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
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
  const action = getAction(request);
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
    if (err) return error("database_request_failed", 503);
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
  const action = getAction(request);
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
    const row = {
      id: uuid(), defect_id: body.defectId, title: body.title,
      root_cause: body.rootCause || "", fix_description: body.fixDescription || "",
      commit_url: body.commitUrl || "", created_at: now(),
    };
    const { data, error: err } = await supabase.from("solutions").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
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
  const action = getAction(request);
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
    const row = {
      id: uuid(), defect_id: body.defectId, status: body.status || "passed",
      notes: body.notes || "", created_at: now(),
    };
    const { data, error: err } = await supabase.from("retests").insert(row).select().single();
    if (err) return error("database_request_failed", 503);
    return json({ item: data }, 201);
  }
  return error("not_found", 404);
}

// --- External Tasks ---
async function handleExternalTasks({ request, supabase }) {
  const action = getAction(request);
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
  const action = getAction(request);
  const pid = getParams(request.url).get("projectId");
  if (action !== "stats") return error("not_found", 404);

  try {
    const results = await Promise.all([
      supabase.from("test_results").select("id,status,case_id,created_at,duration_ms", { count: "exact" }).limit(1),
      supabase.from("defects").select("id,status", { count: "exact" }).limit(1),
      supabase.from("test_cases").select("id,status,priority", { count: "exact" }).limit(1),
    ]);

    const totalResults = results[0].count ?? 0;
    const totalDefects = results[1].count ?? 0;
    const totalCases = results[2].count ?? 0;

    // Get status distribution
    const { data: statusData } = await supabase.from("test_cases").select("status").eq("project_id", pid || "");
    const statusDist = {};
    (statusData || []).forEach(c => { statusDist[c.status] = (statusDist[c.status] || 0) + 1; });

    // Get priority distribution
    const { data: priorityData } = await supabase.from("test_cases").select("status,priority").eq("project_id", pid || "");
    const priorityDist = {};
    (priorityData || []).forEach(c => {
      if (!priorityDist[c.priority]) priorityDist[c.priority] = { passed: 0, failed: 0 };
      if (c.status === "passed") priorityDist[c.priority].passed++;
      else if (c.status === "failed") priorityDist[c.priority].failed++;
    });

    // Get failed top cases
    const { data: failedResults } = await supabase.from("test_results").select("case_id").eq("status", "failed");
    const failCounts = {};
    (failedResults || []).forEach(r => { failCounts[r.case_id] = (failCounts[r.case_id] || 0) + 1; });
    const topFailed = Object.entries(failCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return json({
      totalResults, totalDefects, totalCases,
      statusDistribution: statusDist,
      priorityDistribution: priorityDist,
      topFailedCases: topFailed.map(([caseId, count]) => ({ caseId, count })),
    });
  } catch {
    return error("database_request_failed", 503);
  }
}

// --- MCP Endpoint ---
const MCP_TOOLS = [
  { name: "create_project", description: "创建项目", params: ["name", "description"] },
  { name: "list_projects", description: "列出所有项目", params: [] },
  { name: "create_test_plan", description: "创建测试计划", params: ["projectId", "name"] },
  { name: "add_test_cases", description: "添加测试用例", params: ["projectId", "cases"] },
  { name: "create_test_run", description: "创建执行批次", params: ["projectId", "name"] },
  { name: "submit_test_result", description: "提交测试结果", params: ["runId", "caseId", "status"] },
  { name: "upload_screenshots", description: "上传截图", params: ["resultId", "screenshots"] },
  { name: "create_defect", description: "创建缺陷", params: ["projectId", "title", "severity"] },
  { name: "add_solution", description: "添加解决方案", params: ["defectId", "title"] },
  { name: "create_retest", description: "创建复测", params: ["defectId", "status"] },
  { name: "link_task", description: "关联外部任务", params: ["projectId", "title", "source"] },
  { name: "get_dashboard", description: "获取看板数据", params: ["projectId"] },
  { name: "get_traceability", description: "获取追溯链", params: ["defectId"] },
];

async function handleMcp({ request, supabase }) {
  const body = await parseBody(request);
  if (!body || body.jsonrpc !== "2.0") return error("invalid_mcp_request", 400);

  const { method, params = {}, id } = body;

  if (method === "tools/list") {
    return json({
      jsonrpc: "2.0", id,
      result: { tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description, inputSchema: { type: "object", properties: Object.fromEntries(t.params.map(p => [p, { type: "string" }])) } })) },
    });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};
    const tool = MCP_TOOLS.find(t => t.name === toolName);
    if (!tool) return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown tool: ${toolName}` } });

    try {
      let result;
      switch (toolName) {
        case "create_project": {
          const row = { id: uuid(), name: args.name, description: args.description || "", status: "active", tags: [], created_at: now(), updated_at: now() };
          const { data, error: err } = await supabase.from("projects").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "list_projects": {
          const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
          result = data || [];
          break;
        }
        case "create_test_plan": {
          const row = { id: uuid(), project_id: args.projectId, name: args.name, description: args.description || "", status: "draft", created_at: now(), updated_at: now() };
          const { data, error: err } = await supabase.from("test_plans").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "add_test_cases": {
          const cases = Array.isArray(args.cases) ? args.cases : [args];
          const rows = cases.map(c => ({
            id: uuid(), project_id: args.projectId, plan_id: args.planId || null,
            name: c.name, description: c.description || "", precondition: c.precondition || "",
            steps: c.steps || "", expected: c.expected || "", priority: c.priority || "P1",
            sort_order: c.sortOrder ?? 0, status: "pending", created_at: now(), updated_at: now(),
          }));
          const { data, error: err } = await supabase.from("test_cases").insert(rows).select();
          if (err) throw new Error("db_error");
          result = data || [];
          break;
        }
        case "create_test_run": {
          const row = { id: uuid(), project_id: args.projectId, plan_id: args.planId || null, name: args.name, trigger_type: "ai", environment: args.environment || "", status: "running", created_at: now(), updated_at: now() };
          const { data, error: err } = await supabase.from("test_runs").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "submit_test_result": {
          const row = { id: uuid(), run_id: args.runId, case_id: args.caseId, status: args.status || "passed", description: args.description || "", duration_ms: args.durationMs || 0, screenshots: args.screenshots || [], created_at: now() };
          const { data, error: err } = await supabase.from("test_results").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "upload_screenshots": {
          const { data, error: err } = await supabase.from("test_results").update({ screenshots: args.screenshots }).eq("id", args.resultId).select().maybeSingle();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "create_defect": {
          const row = { id: uuid(), project_id: args.projectId, result_id: args.resultId || null, case_id: args.caseId || null, title: args.title, description: args.description || "", severity: args.severity || "major", status: "open", created_at: now(), updated_at: now() };
          const { data, error: err } = await supabase.from("defects").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "add_solution": {
          const row = { id: uuid(), defect_id: args.defectId, title: args.title, root_cause: args.rootCause || "", fix_description: args.fixDescription || "", commit_url: args.commitUrl || "", created_at: now() };
          const { data, error: err } = await supabase.from("solutions").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "create_retest": {
          const row = { id: uuid(), defect_id: args.defectId, status: args.status || "passed", notes: args.notes || "", created_at: now() };
          const { data, error: err } = await supabase.from("retests").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "link_task": {
          const row = { id: uuid(), project_id: args.projectId, title: args.title, source: args.source || "manual", external_id: args.externalId || "", external_url: args.externalUrl || "", created_at: now() };
          const { data, error: err } = await supabase.from("external_tasks").insert(row).select().single();
          if (err) throw new Error("db_error");
          result = data;
          break;
        }
        case "get_dashboard": {
          const { data: cases } = await supabase.from("test_cases").select("status,priority").eq("project_id", args.projectId || "");
          const { data: defects } = await supabase.from("defects").select("status").eq("project_id", args.projectId || "");
          const { data: results } = await supabase.from("test_results").select("status").eq("project_id", args.projectId || "");
          result = { cases: cases || [], defects: defects || [], results: results || [] };
          break;
        }
        case "get_traceability": {
          const { data: defect } = await supabase.from("defects").select("*").eq("id", args.defectId).maybeSingle();
          const { data: solutions } = await supabase.from("solutions").select("*").eq("defect_id", args.defectId);
          const { data: retests } = await supabase.from("retests").select("*").eq("defect_id", args.defectId);
          result = { defect, solutions: solutions || [], retests: retests || [] };
          break;
        }
        default:
          return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unhandled tool: ${toolName}` } });
      }
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
    } catch {
      return json({ jsonrpc: "2.0", id, error: { code: -32000, message: "Tool execution failed" } });
    }
  }

  return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `Unknown method: ${method}` } });
}

// --- Main Router ---
export async function handleApp({ request, supabase }) {
  const url = new URL(request.url);
  const path = url.pathname;

  // MCP endpoint
  if (path.endsWith("/mcp") && request.method === "POST") {
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
