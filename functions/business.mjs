export const MAX_ERROR_LOG_LENGTH = 65536;
export const RESULT_STATUSES = ["passed", "failed", "skipped", "blocked"];

export class BusinessError extends Error {
  constructor(code, httpStatus = 400) {
    super(code);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

function required(value) {
  if (typeof value !== "string" || !value.trim()) throw new BusinessError("missing_fields");
  return value;
}

function optionalText(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value !== "string") throw new BusinessError("invalid_fields");
  return value;
}

export function resultRow(input) {
  required(input?.runId);
  required(input?.caseId);
  if (!RESULT_STATUSES.includes(input.status)) throw new BusinessError("invalid_result_status");
  const errorLog = optionalText(input.errorLog);
  if (Array.from(errorLog).length > MAX_ERROR_LOG_LENGTH) throw new BusinessError("error_log_too_large", 413);
  const duration = input.durationMs ?? 0;
  if (!Number.isSafeInteger(duration) || duration < 0) throw new BusinessError("invalid_duration");
  if (input.screenshots != null && (!Array.isArray(input.screenshots) || input.screenshots.some(s => !(typeof s === "string" || (s && typeof s === "object" && typeof s.dataUrl === "string" && (s.caption == null || typeof s.caption === "string") && (s.sortOrder == null || Number.isInteger(s.sortOrder) && s.sortOrder >= 0)))))) throw new BusinessError("invalid_screenshots");
  if (input.executedAt != null && (typeof input.executedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(input.executedAt))) throw new BusinessError("invalid_execution_time");
  const executed = input.executedAt == null ? new Date() : new Date(input.executedAt);
  if (!Number.isFinite(executed.getTime())) throw new BusinessError("invalid_execution_time");
  return {
    id: crypto.randomUUID(), run_id: input.runId, case_id: input.caseId,
    status: input.status, description: optionalText(input.description), error_log: errorLog,
    duration_ms: duration, screenshots: input.screenshots ?? [], created_at: executed.toISOString(),
  };
}

export function solutionRow(input) {
  return {
    id: crypto.randomUUID(), defect_id: required(input?.defectId), title: required(input?.title),
    root_cause: optionalText(input.rootCause), fix_description: optionalText(input.fixDescription),
    commit_url: optionalText(input.commitUrl), created_at: new Date().toISOString(),
  };
}

export function retestRow(input) {
  required(input?.defectId);
  if (!["passed", "failed"].includes(input.status)) throw new BusinessError("invalid_retest_status");
  return { id: crypto.randomUUID(), defect_id: input.defectId, status: input.status, notes: optionalText(input.notes), created_at: new Date().toISOString() };
}

// No sequential-write fallback: a missing migration must fail before saving.
async function save(supabase, operation, row) {
  try {
    const { data, error } = await supabase.rpc(operation, { p_input: row });
    if (error) {
      if (error.code === "23514") throw new BusinessError("invalid_state_transition", 409);
      if (error.code === "23503") throw new BusinessError("related_record_not_found", 404);
      if (error.code === "22023") throw new BusinessError("invalid_relationship", 400);
      throw new BusinessError("database_request_failed", 503);
    }
    if (!data) throw new BusinessError("database_request_failed", 503);
    return data;
  } catch (error) {
    if (error instanceof BusinessError) throw error;
    // Provider details may contain credentials, request URLs or customer input.
    throw new BusinessError("database_request_failed", 503);
  }
}

export const submitTestResult = (supabase, input) => save(supabase, "dashboard_submit_result", resultRow(input));
export const addSolution = (supabase, input) => save(supabase, "dashboard_add_solution", solutionRow(input));
export const createRetest = (supabase, input) => save(supabase, "dashboard_create_retest", retestRow(input));
