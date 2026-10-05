import { MAX_ERROR_LOG_LENGTH } from "./business.mjs";

// Stateless Streamable HTTP: no in-memory session is required across Function instances.
// See https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
const versions = ["2025-11-25", "2025-06-18", "2025-03-26"];
const text = { type: "string" };
const nonempty = { type: "string", minLength: 1 };
const integer = { type: "integer", minimum: 0 };
const object = (properties, required = []) => ({ type: "object", properties, required, additionalProperties: false });
const array = (items, minItems = 0) => ({ type: "array", items, minItems });
const resultStatus = { type: "string", enum: ["passed", "failed", "skipped", "blocked"] };
const screenshot = object({ dataUrl: nonempty, caption: text, sortOrder: integer }, ["dataUrl"]);
const screenshots = array({ anyOf: [nonempty, screenshot] });
const caseSchema = object({
  name: nonempty, description: text, precondition: text, steps: text, expected: text,
  priority: { type: "string", enum: ["P0", "P1", "P2", "P3"] }, sortOrder: integer,
}, ["name"]);

// These definitions drive tools/list, validation, and dispatch together.
const definitions = [
  { name: "create_project", description: "Create a project", inputSchema: object({ name: nonempty, description: text }, ["name"]), action: "project_create" },
  { name: "list_projects", description: "List projects", inputSchema: object({}), action: "project_list", method: "GET" },
  { name: "create_test_plan", description: "Create a test plan", inputSchema: object({ projectId: nonempty, name: nonempty, description: text }, ["projectId", "name"]), action: "plan_create" },
  { name: "add_test_cases", description: "Add test cases in one batch", inputSchema: object({ projectId: nonempty, planId: nonempty, cases: array(caseSchema, 1) }, ["projectId", "cases"]) },
  { name: "create_test_run", description: "Create a running test run", inputSchema: object({ projectId: nonempty, planId: nonempty, name: nonempty, environment: text }, ["projectId", "name"]), action: "run_create" },
  { name: "submit_test_result", description: "Submit a test result and update the case status", inputSchema: object({ runId: nonempty, caseId: nonempty, status: resultStatus, description: text, errorLog: { ...text, maxLength: MAX_ERROR_LOG_LENGTH }, durationMs: integer, screenshots, executedAt: { type: "string", format: "date-time" } }, ["runId", "caseId", "status"]), action: "result_create" },
  { name: "upload_screenshots", description: "Replace a result's screenshots", inputSchema: object({ resultId: nonempty, screenshots }, ["resultId", "screenshots"]) },
  { name: "create_defect", description: "Create a defect", inputSchema: object({ projectId: nonempty, resultId: nonempty, caseId: nonempty, title: nonempty, description: text, severity: { type: "string", enum: ["critical", "major", "minor", "trivial"] } }, ["projectId", "title"]), action: "defect_create" },
  { name: "add_solution", description: "Record a solution and mark the defect fixed", inputSchema: object({ defectId: nonempty, title: nonempty, rootCause: text, fixDescription: text, commitUrl: text }, ["defectId", "title"]), action: "solution_create" },
  { name: "create_retest", description: "Record a retest and update the defect status", inputSchema: object({ defectId: nonempty, status: { type: "string", enum: ["passed", "failed"] }, notes: text }, ["defectId", "status"]), action: "retest_create" },
  { name: "link_task", description: "Link an external task", inputSchema: object({ projectId: nonempty, title: nonempty, source: { type: "string", enum: ["jira", "github", "manual", "other"] }, externalId: text, externalUrl: text }, ["projectId", "title"]), action: "task_create" },
  { name: "get_dashboard", description: "Get aggregated dashboard statistics", inputSchema: object({ projectId: nonempty }), action: "dashboard_stats", method: "GET" },
  { name: "get_traceability", description: "Get a defect's solutions and retests", inputSchema: object({ defectId: nonempty }, ["defectId"]) },
];
export const MCP_TOOLS = definitions.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }));

const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
function validate(schema, value, path = "arguments") {
  if (schema.anyOf) return schema.anyOf.some(option => !validate(option, value, path)) ? null : `${path} must be a screenshot reference or screenshot object`;
  if (schema.type === "object") {
    if (!isObject(value)) return `${path} must be an object`;
    for (const key of schema.required) if (!Object.hasOwn(value, key)) return `${path}.${key} is required`;
    for (const [key, item] of Object.entries(value)) {
      if (!Object.hasOwn(schema.properties, key)) return `${path} contains an unsupported field`;
      const issue = validate(schema.properties[key], item, `${path}.${key}`);
      if (issue) return issue;
    }
  } else if (schema.type === "array") {
    if (!Array.isArray(value)) return `${path} must be an array`;
    if (value.length < schema.minItems) return `${path} needs at least ${schema.minItems} item(s)`;
    for (let i = 0; i < value.length; i++) {
      const issue = validate(schema.items, value[i], `${path}[${i}]`);
      if (issue) return issue;
    }
  } else if (schema.type === "integer") {
    if (!Number.isSafeInteger(value) || value < schema.minimum || (schema.maximum !== undefined && value > schema.maximum)) return `${path} is outside the allowed integer range`;
  } else if (schema.type === "string") {
    if (typeof value !== "string") return `${path} must be a string`;
    if (schema.minLength && value.trim().length < schema.minLength) return `${path} must not be empty`;
    if (schema.maxLength && Array.from(value).length > schema.maxLength) return `${path} exceeds the allowed length`;
    if (schema.enum && !schema.enum.includes(value)) return `${path} must be an allowed value`;
    if (schema.format === "date-time" && (!/^\d{4}-\d\d-\d\d[Tt]\d\d:\d\d:\d\d(?:\.\d+)?(?:[Zz]|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)))) return `${path} must be an ISO date-time`;
  }
  return null;
}

const json = body => Response.json(body, { headers: { "cache-control": "no-store" } });
const rpcError = (id, code, message, status = 200) => Response.json({ jsonrpc: "2.0", id, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
const accepted = () => new Response(null, { status: 202, headers: { "cache-control": "no-store" } });

async function execute(definition, args, { request, supabase, dispatch }) {
  if (definition.action) {
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(/\/mcp$/, "");
    url.search = "";
    url.searchParams.set("action", definition.action);
    const method = definition.method || "POST";
    if (method === "GET") for (const [key, value] of Object.entries(args)) url.searchParams.set(key, String(value));
    const body = definition.name === "create_test_run" ? { ...args, triggerType: "ai" } : args;
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    const internal = new Request(url, { method, headers, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) });
    const response = await dispatch({ request: internal, supabase });
    const data = await response.json();
    if (!response.ok) throw new Error("Tool execution failed");
    // Keep pagination metadata for list tools so clients can request another page.
    return Object.hasOwn(data, "item") ? data.item : data;
  }
  if (definition.name === "add_test_cases") {
    const rows = args.cases.map(c => ({
      id: crypto.randomUUID(), project_id: args.projectId, plan_id: args.planId || null,
      name: c.name, description: c.description || "", precondition: c.precondition || "",
      steps: c.steps || "", expected: c.expected || "", priority: c.priority || "P1",
      sort_order: c.sortOrder ?? 0, status: "pending", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase.from("test_cases").insert(rows).select();
    if (error) throw new Error("Tool execution failed");
    return data || [];
  }
  if (definition.name === "upload_screenshots") {
    const { data, error } = await supabase.from("test_results").update({ screenshots: args.screenshots }).eq("id", args.resultId).select().maybeSingle();
    if (error || !data) throw new Error("Tool execution failed");
    return data;
  }
  const results = await Promise.all([
    supabase.from("defects").select("*").eq("id", args.defectId).maybeSingle(),
    supabase.from("solutions").select("*").eq("defect_id", args.defectId).order("created_at", { ascending: true }),
    supabase.from("retests").select("*").eq("defect_id", args.defectId).order("created_at", { ascending: true }),
  ]);
  if (results.some(result => result.error) || !results[0].data) throw new Error("Tool execution failed");
  return { defect: results[0].data, solutions: results[1].data || [], retests: results[2].data || [] };
}

export async function handleMcp(context) {
  const { request } = context;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return rpcError(null, -32600, "Invalid origin", 403);
  const version = request.headers.get("mcp-protocol-version");
  if (version && !versions.includes(version)) return rpcError(null, -32600, "Unsupported protocol version", 400);
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST", "cache-control": "no-store" } });
  let body;
  try { body = await request.json(); } catch { return rpcError(null, -32700, "Parse error", 400); }
  if (!isObject(body) || body.jsonrpc !== "2.0" || typeof body.method !== "string" || (Object.hasOwn(body, "id") && !(typeof body.id === "string" || Number.isSafeInteger(body.id)))) return rpcError(null, -32600, "Invalid request", 400);
  const { method, params = {}, id } = body;
  const notification = !Object.hasOwn(body, "id");
  if (!isObject(params)) return notification ? new Response(null, { status: 400 }) : rpcError(id, -32602, "Params must be an object");
  // Notifications never receive a JSON-RPC response. No server-side session state
  // or outbound notifications are advertised by this stateless endpoint.
  if (notification) {
    if (!method.startsWith("notifications/")) return new Response(null, { status: 400 });
    return accepted();
  }
  if (method === "initialize") {
    if (typeof params.protocolVersion !== "string" || !isObject(params.capabilities) || !isObject(params.clientInfo) || typeof params.clientInfo.name !== "string" || typeof params.clientInfo.version !== "string") return rpcError(id, -32602, "Invalid initialize parameters");
    return json({ jsonrpc: "2.0", id, result: { protocolVersion: versions.includes(params.protocolVersion) ? params.protocolVersion : versions[0], capabilities: { tools: { listChanged: false } }, serverInfo: { name: "test-dashboard", version: "0.1.0" } } });
  }
  if (method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") {
    if (params.cursor !== undefined) return rpcError(id, -32602, "Invalid cursor");
    return json({ jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } });
  }
  if (method !== "tools/call") return rpcError(id, -32601, "Method not found");
  const definition = definitions.find(tool => tool.name === params.name);
  if (!definition) return rpcError(id, -32602, "Unknown tool");
  const args = params.arguments === undefined ? {} : params.arguments;
  const issue = validate(definition.inputSchema, args);
  if (issue) return rpcError(id, -32602, issue);
  try {
    const result = await execute(definition, args, context);
    return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] } });
  } catch {
    // Never expose DB responses, credentials, or user arguments in protocol errors.
    return json({ jsonrpc: "2.0", id, result: { isError: true, content: [{ type: "text", text: "Tool execution failed" }] } });
  }
}
