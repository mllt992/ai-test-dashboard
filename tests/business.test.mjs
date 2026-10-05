import test from "node:test";
import assert from "node:assert/strict";
import { submitTestResult, addSolution, createRetest, MAX_ERROR_LOG_LENGTH } from "../functions/business.mjs";
import { handleApp } from "../functions/handler.mjs";
import { createDatabase, databaseClient } from "./support/db.mjs";

const project = "10000000-0000-4000-8000-000000000001";
const caseId = "20000000-0000-4000-8000-000000000001";
const runId = "30000000-0000-4000-8000-000000000001";
const defectId = "40000000-0000-4000-8000-000000000001";
async function setup(t) {
  const db = await createDatabase();
  t.after(() => db.close());
  await db.query("INSERT INTO test_cases (id,project_id,status) VALUES ($1,$2,'pending')", [caseId, project]);
  await db.query("INSERT INTO test_runs (id,project_id,status) VALUES ($1,$2,'running')", [runId, project]);
  await db.query("INSERT INTO defects (id,project_id,status) VALUES ($1,$2,'open')", [defectId, project]);
  return { db, supabase: databaseClient(db) };
}
const submit = (supabase, status, executedAt, extra = {}) => submitTestResult(supabase, { runId, caseId, status, executedAt, ...extra });
async function caseStatus(db) { return (await db.query("SELECT status FROM test_cases WHERE id=$1", [caseId])).rows[0].status; }
async function defectStatus(db) { return (await db.query("SELECT status FROM defects WHERE id=$1", [defectId])).rows[0].status; }
async function count(db, table) { return Number((await db.query(`SELECT count(*) FROM ${table}`)).rows[0].count); }

test("all result states update the case atomically and preserve historical rows", async t => {
  const { db, supabase } = await setup(t);
  for (const [index, status] of ["passed", "failed", "skipped", "blocked"].entries()) {
    await submit(supabase, status, `2026-10-05T10:0${index}:00Z`);
    assert.equal(await caseStatus(db), status);
  }
  assert.equal(await count(db, "test_results"), 4);
  await assert.rejects(db.query("UPDATE test_results SET status='passed' WHERE status='failed'"), /result_history_is_immutable/);
});

test("older arrivals and concurrent submissions retain latest execution state", async t => {
  const { db, supabase } = await setup(t);
  await submit(supabase, "failed", "2026-10-05T12:00:00Z");
  await submit(supabase, "passed", "2026-10-05T11:00:00Z");
  assert.equal(await caseStatus(db), "failed");
  await Promise.all([
    submit(supabase, "blocked", "2026-10-05T14:00:00Z"),
    submit(supabase, "passed", "2026-10-05T13:00:00Z"),
    submit(supabase, "skipped", "2026-10-05T12:30:00Z"),
  ]);
  assert.equal(await caseStatus(db), "blocked");
  assert.equal(await count(db, "test_results"), 5);
  // Same execution instant uses UUID as a deterministic tie-breaker.
  await db.query("INSERT INTO test_results(id,run_id,case_id,status,created_at) VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff',$1,$2,'passed','2026-10-05T14:00:00Z')", [runId, caseId]);
  assert.equal(await caseStatus(db), "passed");
  await db.query("DELETE FROM test_results WHERE id='ffffffff-ffff-4fff-8fff-ffffffffffff'");
  assert.equal(await caseStatus(db), "blocked");
});

test("a rejected result rolls back both history and case state", async t => {
  const { db, supabase } = await setup(t);
  await db.exec("ALTER TABLE test_cases ADD CONSTRAINT deliberately_reject_failed CHECK(status <> 'failed')");
  await assert.rejects(submit(supabase, "failed"), e => e.code === "invalid_state_transition");
  assert.equal(await count(db, "test_results"), 0);
  assert.equal(await caseStatus(db), "pending");
  await assert.rejects(submitTestResult(supabase, { runId: crypto.randomUUID(), caseId, status: "passed" }), e => e.code === "related_record_not_found");
});

test("result run and case must belong to the same project/plan", async t => {
  const { db, supabase } = await setup(t);
  await db.query("UPDATE test_runs SET project_id=$1 WHERE id=$2", [crypto.randomUUID(), runId]);
  await assert.rejects(submit(supabase, "passed"), e => e.code === "invalid_relationship");
  assert.equal(await count(db, "test_results"), 0);
});

test("solutions and retests follow the defect state machine including re-fixing", async t => {
  const { db, supabase } = await setup(t);
  await addSolution(supabase, { defectId, title: "Initial fix" });
  assert.equal(await defectStatus(db), "fixed");
  await createRetest(supabase, { defectId, status: "failed", notes: "Still broken" });
  assert.equal(await defectStatus(db), "reopened");
  await db.query("UPDATE defects SET status='in_progress' WHERE id=$1", [defectId]);
  await addSolution(supabase, { defectId, title: "Second fix" });
  await createRetest(supabase, { defectId, status: "passed" });
  assert.equal(await defectStatus(db), "verified");
  await db.query("UPDATE defects SET status='closed' WHERE id=$1", [defectId]);
  assert.equal(await defectStatus(db), "closed");
  assert.equal(await count(db, "solutions"), 2);
  assert.equal(await count(db, "retests"), 2);
});

test("illegal, concurrent or failed defect writes never produce partial success", async t => {
  const { db, supabase } = await setup(t);
  await assert.rejects(createRetest(supabase, { defectId, status: "passed" }), e => e.httpStatus === 409);
  await assert.rejects(db.query("UPDATE defects SET status='closed' WHERE id=$1", [defectId]), /invalid_defect_transition/);
  assert.equal(await count(db, "retests"), 0);
  await db.exec("ALTER TABLE solutions ADD CONSTRAINT deliberately_reject_title CHECK(title <> 'Rejected')");
  await assert.rejects(addSolution(supabase, { defectId, title: "Rejected" }), e => e.httpStatus === 409);
  assert.equal(await defectStatus(db), "open");
  assert.equal(await count(db, "solutions"), 0);
  await addSolution(supabase, { defectId, title: "Fix" });
  await assert.rejects(db.query("UPDATE defects SET status='verified' WHERE id=$1", [defectId]), /invalid_defect_transition/);
  const attempts = await Promise.allSettled([createRetest(supabase, { defectId, status: "passed" }), createRetest(supabase, { defectId, status: "failed" })]);
  assert.equal(attempts.filter(a => a.status === "fulfilled").length, 1);
  assert.equal(await count(db, "retests"), 1);
});

test("error logs round trip Unicode and newlines; maximum is code points without truncation", async t => {
  const { db, supabase } = await setup(t);
  const log = "第一行\nError: 测试失败 😀\r\nlast line\t细节";
  const result = await submit(supabase, "failed", undefined, { errorLog: log });
  assert.equal(result.error_log, log);
  assert.equal((await db.query("SELECT error_log FROM test_results WHERE id=$1", [result.id])).rows[0].error_log, log);
  await submit(supabase, "failed", undefined, { errorLog: "😀".repeat(MAX_ERROR_LOG_LENGTH) });
  assert.throws(() => submit(supabase, "failed", undefined, { errorLog: "😀".repeat(MAX_ERROR_LOG_LENGTH + 1) }), e => e.httpStatus === 413);
  assert.equal(await count(db, "test_results"), 2);
});

test("REST and MCP submissions use identical atomic persistence and preserve error logs", async t => {
  const { db, supabase } = await setup(t);
  const log = "MCP\n错误 🔧";
  const web = await handleApp({ supabase, request: new Request("http://localhost/?action=result_create", { method: "POST", body: JSON.stringify({ runId, caseId, status: "failed", errorLog: log, executedAt: "2026-10-05T00:00:00Z" }) }) });
  assert.equal(web.status, 201);
  assert.equal(await caseStatus(db), "failed");
  const mcp = await handleApp({ supabase, request: new Request("http://localhost/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "submit_test_result", arguments: { runId, caseId, status: "passed", errorLog: log, executedAt: "2026-10-05t00:01:00z" } } }) }) });
  const reply = await mcp.json();
  assert.equal(reply.result.isError, undefined);
  const saved = JSON.parse(reply.result.content[0].text);
  assert.equal(saved.error_log, log);
  assert.equal(new Date(saved.created_at).toISOString(), "2026-10-05T00:01:00.000Z");
  assert.equal(await caseStatus(db), "passed");
});

test("REST and MCP solution/retest share legal transitions and fail safely without migrations", async t => {
  const { db, supabase } = await setup(t);
  const web = await handleApp({ supabase, request: new Request("http://localhost/?action=solution_create", { method: "POST", body: JSON.stringify({ defectId, title: "Web fix" }) }) });
  assert.equal(web.status, 201);
  const mcp = await handleApp({ supabase, request: new Request("http://localhost/mcp", { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "create_retest", arguments: { defectId, status: "passed" } } }) }) });
  assert.equal((await mcp.json()).result.isError, undefined);
  assert.equal(await defectStatus(db), "verified");
  const missing = await handleApp({ supabase: { rpc: async () => ({ error: { code: "PGRST202", message: "private-provider-detail" } }) }, request: new Request("http://localhost/?action=result_create", { method: "POST", body: JSON.stringify({ runId, caseId, status: "failed" }) }) });
  assert.equal(missing.status, 503);
  assert.deepEqual(await missing.json(), { error: "database_request_failed" });
});

test("runs acquire completion time only at an explicit completed transition", async t => {
  const { db } = await setup(t);
  assert.equal((await db.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at, null);
  await db.query("UPDATE test_runs SET name='Still running' WHERE id=$1", [runId]);
  assert.equal((await db.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at, null);
  await db.query("UPDATE test_runs SET status='completed' WHERE id=$1", [runId]);
  const completed = (await db.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at;
  assert.ok(completed);
  await db.query("UPDATE test_runs SET name='Edited', finished_at='2000-01-01' WHERE id=$1", [runId]);
  assert.equal((await db.query("SELECT finished_at FROM test_runs WHERE id=$1", [runId])).rows[0].finished_at.getTime(), completed.getTime());
  await assert.rejects(db.query("UPDATE test_runs SET status='running' WHERE id=$1", [runId]), /invalid_run_transition/);
});

test("suppressed state updates roll back the corresponding business records", async t => {
  const { db, supabase } = await setup(t);
  // Simulate a pre-existing trigger that suppresses updates, without disabling RLS.
  await db.exec(`CREATE FUNCTION suppress_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END $$;
    CREATE TRIGGER suppress_case_update BEFORE UPDATE ON test_cases FOR EACH ROW EXECUTE FUNCTION suppress_update();
    CREATE TRIGGER suppress_defect_update BEFORE UPDATE ON defects FOR EACH ROW EXECUTE FUNCTION suppress_update();`);
  await assert.rejects(submit(supabase, "passed"), e => e.httpStatus === 503);
  await assert.rejects(addSolution(supabase, { defectId, title: "Fix" }), e => e.httpStatus === 503);
  assert.equal(await count(db, "test_results"), 0);
  assert.equal(await count(db, "solutions"), 0);
  assert.equal(await caseStatus(db), "pending");
  assert.equal(await defectStatus(db), "open");
});

test("case status cannot be manually changed independently of result history", async t => {
  const { db, supabase } = await setup(t);
  await assert.rejects(db.query("UPDATE test_cases SET status='passed' WHERE id=$1", [caseId]), /case_state_requires_result/);
  const request = new Request("http://localhost/?action=case_update", { method: "PATCH", body: JSON.stringify({ id: caseId, status: "failed" }) });
  const response = await handleApp({ request, supabase });
  assert.equal(response.status, 409);
  assert.equal(await caseStatus(db), "pending");
});

test("case and project deletion work with optional ON DELETE CASCADE foreign keys", async t => {
  const { db, supabase } = await setup(t);
  await db.query("INSERT INTO projects(id,name) VALUES($1,'Cascade test')", [project]);
  await db.exec(`ALTER TABLE test_cases ADD CONSTRAINT test_case_project_fk FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE;
    ALTER TABLE test_runs ADD CONSTRAINT test_run_project_fk FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE;
    ALTER TABLE test_results ADD CONSTRAINT test_result_case_fk FOREIGN KEY(case_id) REFERENCES test_cases(id) ON DELETE CASCADE;
    ALTER TABLE test_results ADD CONSTRAINT test_result_run_fk FOREIGN KEY(run_id) REFERENCES test_runs(id) ON DELETE CASCADE;`);
  await submit(supabase, "failed");
  await db.query("DELETE FROM test_cases WHERE id=$1", [caseId]);
  assert.equal(await count(db, "test_cases"), 0);
  assert.equal(await count(db, "test_results"), 0);

  await db.query("INSERT INTO test_cases(id,project_id,status) VALUES($1,$2,'pending')", [caseId, project]);
  await submit(supabase, "passed");
  await db.query("DELETE FROM projects WHERE id=$1", [project]);
  assert.equal(await count(db, "projects"), 0);
  assert.equal(await count(db, "test_cases"), 0);
  assert.equal(await count(db, "test_runs"), 0);
  assert.equal(await count(db, "test_results"), 0);
});

test("direct result deletion cannot leave the status pointer stale when RLS hides its case", async t => {
  const { db, supabase } = await setup(t);
  const result = await submit(supabase, "failed");
  // Roles/grants are restricted to this disposable in-memory test database.
  // The shipped migration adds none and keeps SECURITY INVOKER behavior.
  await db.exec(`CREATE ROLE dashboard_delete_test;
    GRANT USAGE ON SCHEMA public TO dashboard_delete_test;
    GRANT SELECT, UPDATE ON test_cases TO dashboard_delete_test;
    GRANT SELECT, DELETE ON test_results TO dashboard_delete_test;
    ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
    CREATE POLICY hidden_case ON test_cases FOR ALL TO dashboard_delete_test USING(false) WITH CHECK(false);
    SET ROLE dashboard_delete_test;`);
  try {
    await assert.rejects(db.query("DELETE FROM test_results WHERE id=$1", [result.id]), /case_not_found/);
  } finally {
    await db.exec("RESET ROLE");
  }
  assert.equal(await count(db, "test_results"), 1);
  const current = (await db.query("SELECT status,latest_result_id FROM test_cases WHERE id=$1", [caseId])).rows[0];
  assert.equal(current.status, "failed");
  assert.equal(current.latest_result_id, result.id);
});

test("dynamic RLS that hides the parent after its last result is deleted rolls back", async t => {
  const { db, supabase } = await setup(t);
  const result = await submit(supabase, "failed");
  await db.exec(`CREATE ROLE dashboard_delete_test;
    GRANT USAGE ON SCHEMA public TO dashboard_delete_test;
    GRANT SELECT, UPDATE ON test_cases TO dashboard_delete_test;
    GRANT SELECT, DELETE ON test_results TO dashboard_delete_test;
    ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
    CREATE POLICY dynamic_case ON test_cases FOR ALL TO dashboard_delete_test
      USING(EXISTS(SELECT 1 FROM test_results WHERE case_id=test_cases.id))
      WITH CHECK(EXISTS(SELECT 1 FROM test_results WHERE case_id=test_cases.id));
    SET ROLE dashboard_delete_test;`);
  try {
    assert.equal((await db.query("SELECT count(*) FROM test_cases")).rows[0].count, 1);
    await assert.rejects(db.query("DELETE FROM test_results WHERE id=$1", [result.id]), /case_not_found/);
  } finally {
    await db.exec("RESET ROLE");
  }
  assert.equal(await count(db, "test_results"), 1);
  assert.equal(await caseStatus(db), "failed");
  assert.equal((await db.query("SELECT latest_result_id FROM test_cases WHERE id=$1", [caseId])).rows[0].latest_result_id, result.id);
});

test("run/case cascade cannot skip ambiguous parent synchronization under an RLS-limited trigger role", async t => {
  const { db, supabase } = await setup(t);
  const result = await submit(supabase, "failed");
  // RI cascades execute under the child table owner. Use different disposable
  // owners to exercise the case where that owner still has active case RLS.
  await db.exec(`CREATE ROLE dashboard_case_owner; CREATE ROLE dashboard_result_owner; CREATE ROLE dashboard_delete_test;
    ALTER TABLE test_cases OWNER TO dashboard_case_owner;
    ALTER TABLE test_results OWNER TO dashboard_result_owner;
    GRANT USAGE ON SCHEMA public TO dashboard_result_owner, dashboard_delete_test;
    GRANT SELECT, UPDATE ON test_cases TO dashboard_result_owner, dashboard_delete_test;
    GRANT SELECT, DELETE ON test_runs TO dashboard_delete_test;
    GRANT SELECT, DELETE ON test_results TO dashboard_delete_test;
    ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
    CREATE POLICY hidden_case ON test_cases USING(false) WITH CHECK(false);
    ALTER TABLE test_results ADD CONSTRAINT result_run_cascade FOREIGN KEY(run_id) REFERENCES test_runs(id) ON DELETE CASCADE;
    SET ROLE dashboard_delete_test;`);
  try {
    await assert.rejects(db.query("DELETE FROM test_runs WHERE id=$1", [runId]), /case_not_found/);
  } finally {
    await db.exec("RESET ROLE");
  }
  assert.equal(await count(db, "test_runs"), 1);
  assert.equal(await count(db, "test_results"), 1);
  assert.equal((await db.query("SELECT latest_result_id FROM test_cases WHERE id=$1", [caseId])).rows[0].latest_result_id, result.id);
  // The caller may delete a visible case while the RI child-owner role still
  // has active case RLS. Actual parent absence must fail closed for that role.
  await db.exec(`GRANT DELETE ON test_cases TO dashboard_delete_test;
    CREATE POLICY visible_case_select ON test_cases FOR SELECT TO dashboard_delete_test USING(true);
    CREATE POLICY visible_case_delete ON test_cases FOR DELETE TO dashboard_delete_test USING(true);
    ALTER TABLE test_results ADD CONSTRAINT result_case_cascade FOREIGN KEY(case_id) REFERENCES test_cases(id) ON DELETE CASCADE;
    SET ROLE dashboard_delete_test;`);
  try {
    await assert.rejects(db.query("DELETE FROM test_cases WHERE id=$1", [caseId]), /case_not_found/);
  } finally {
    await db.exec("RESET ROLE");
  }
  assert.equal(await count(db, "test_cases"), 1);
  assert.equal(await count(db, "test_results"), 1);
  assert.equal(await caseStatus(db), "failed");
});

test("deleting non-current history under result RLS preserves a hidden newer result's case state", async t => {
  const { db, supabase } = await setup(t);
  const older = await submit(supabase, "failed", "2026-10-05T10:00:00Z");
  const newer = await submit(supabase, "passed", "2026-10-05T11:00:00Z");
  const before = (await db.query("SELECT status,latest_result_id,latest_result_at,updated_at FROM test_cases WHERE id=$1", [caseId])).rows[0];
  await db.exec(`CREATE ROLE dashboard_delete_test;
    GRANT USAGE ON SCHEMA public TO dashboard_delete_test;
    GRANT SELECT, UPDATE ON test_cases TO dashboard_delete_test;
    GRANT SELECT, DELETE ON test_results TO dashboard_delete_test;
    ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY visible_failed_results ON test_results FOR ALL TO dashboard_delete_test USING(status='failed') WITH CHECK(status='failed');
    SET ROLE dashboard_delete_test;`);
  try {
    assert.equal((await db.query("SELECT count(*) FROM test_results")).rows[0].count, 1);
    await db.query("DELETE FROM test_results WHERE id=$1", [older.id]);
  } finally {
    await db.exec("RESET ROLE");
  }
  assert.equal(await count(db, "test_results"), 1);
  assert.equal((await db.query("SELECT id FROM test_results")).rows[0].id, newer.id);
  const after = (await db.query("SELECT status,latest_result_id,latest_result_at,updated_at FROM test_cases WHERE id=$1", [caseId])).rows[0];
  assert.deepEqual(after, before);
});

test("deleting the current result under filtered history RLS is rejected and rolled back", async t => {
  const { db, supabase } = await setup(t);
  await submit(supabase, "passed", "2026-10-05T10:00:00Z");
  const current = await submit(supabase, "failed", "2026-10-05T11:00:00Z");
  const before = (await db.query("SELECT status,latest_result_id,latest_result_at,updated_at FROM test_cases WHERE id=$1", [caseId])).rows[0];
  await db.exec(`CREATE ROLE dashboard_delete_test;
    GRANT USAGE ON SCHEMA public TO dashboard_delete_test;
    GRANT SELECT, UPDATE ON test_cases TO dashboard_delete_test;
    GRANT SELECT, DELETE ON test_results TO dashboard_delete_test;
    ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
    CREATE POLICY visible_failed_results ON test_results FOR ALL TO dashboard_delete_test USING(status='failed') WITH CHECK(status='failed');
    SET ROLE dashboard_delete_test;`);
  try {
    await assert.rejects(db.query("DELETE FROM test_results WHERE id=$1", [current.id]), error => error.code === "42501" && /result_history_not_fully_visible/.test(error.message));
  } finally {
    await db.exec("RESET ROLE");
  }
  assert.equal(await count(db, "test_results"), 2);
  const after = (await db.query("SELECT status,latest_result_id,latest_result_at,updated_at FROM test_cases WHERE id=$1", [caseId])).rows[0];
  assert.deepEqual(after, before);
});
